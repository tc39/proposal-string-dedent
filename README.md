# Multi backtick templates with automatic margin stripping

Author: [@mmkal](https://github.com/mmkal)

Status: draft

[Original TC39 thread](https://es.discourse.group/t/triple-backtick-template-literal-with-indentation-support/337/6)

## Problem

Javascript template literals force users to choose between strange-looking code, have the resultant outputs include unwanted indentation, or rely on third-party dependencies to "fix" template margins. They also require escaping backticks, limiting the ability to put code samples inside templates for languages which include backticks (e.g. javascript/markdown/bash).

The current options:

### Strange-looking code

```javascript
class MyClass {
  print() {
    console.log(`create table student(
  id int primary key
  name text
)`)
  }
}
```

### Sensible-looking code, with unwanted indents in output

```javascript
class MyClass {
  print() {
    console.log(`
      create table student(
        id int primary key
        name text
      )
    `)
  }
}
```

This prints:

<pre>

      create table student(
        id int primary key
        name text
      )
      
</pre>

Note the newlines at the start and end of the output, and a margin on each line.

### With a library

A commonly used one is [dedent](https://npmjs.com/package/dedent):

```javascript
import dedent from 'dedent'

class MyClass {
  print() {
    console.log(dedent`
      create table student(
        id int primary key
        name text
      )
    `)
  }
}
```

Now the input and output look about right, but we've had to add a runtime dependency. This makes what could be pure data less portable. You can no longer copy-paste snippets, you have to copy-paste snippets, install an npm package, maybe install the types too, import it and then use it. This solution also cannot be used in ecmascript-compatible data formats like [json5](https://npmjs.com/package/json5).

Similarly, [jest-inline-snapshots](https://jestjs.io/docs/en/snapshot-testing#inline-snapshots) automatically "dedent" literal snapshots at runtime. There is also a [babel plugin](https://www.npmjs.com/package/babel-plugin-dedent) which moves the "dedenting" to compile-time.

This presents a problem when template expression tags also need to be used:

<pre>
const raw = dedent`
  query foo {
    bar
  }
`;

gql`${raw}`; // <- this doesn't work right.
</pre>

To get around this, we have to rely on the tagged template being callable as a regular function:

```javascript
gql(raw)
```

This doesn't allow for customized behaviour of expressions. For example, [slonik](https://npmjs.com/package/slonik) protects against sql injection by automatically sanitizing expression parameters. To solve that, we could extended `dedent` to compose with other tags:

```javascript
const query = dedent(sql)`
  select *
  from students
  where name = ${name}
`
```

But there are negative implications to this. Quote from [the original tc39 thread](https://es.discourse.group/t/triple-backtick-template-literal-with-indentation-support/337/7):

> [This approach] is not free (some runtime processing and WeakMap lookup), and will conflict with the "templateness" in proposals like https://github.com/tc39/proposal-array-is-template-object.

It'd be better this could be supported at the language level, to avoid:
- all of the above complexity
- the runtime implications of squashing so much parsing responsibility into `dedent` or similar libraries
- inconsistencies between implementations of "dedenters" (jest vs dedent vs babel-plugin-dedent)
- the need for coupling `dedent` to the implementation particulars of other tagged template literal functions
- the need to teach formatters like [prettier](https://npmjs.com/package/prettier) that they can safely adjust the margins of _some_ templates, but not others (and even in these cases, the formatter would have knowledge about the context and implementation details of the various dedenting libraries):
  - <pre>dedent`...`</pre>
  - <pre>dedent(anything)`...`</pre>
  - <pre>.toMatchInlineSnapshot(`...`)</pre>

## Proposed solution

Allow specifying triple-, quintuple-, or septuple-, or any-odd-number-uple- backticked literals, which behave almost the same as a regular backticked template literal, with a few key differences:

- The string is automatically "dedented", along the lines of what the dedent library does. A simple strawman algorithm:
  - the first and last lines (the ones including delimiters) are ignored
  - the "margin" is calculated using the whitespace at the beginning of the first line
  - that margin is removed from the start of every line
- The opening delimiter must be immediately followed by a newline
- The closing delimiter must only contain whitespace between it and the previous newline
- Backticks inside the string don't need to be escaped

The examples above would simplify to something like this:

<pre>
class MyClass {
  print() {
    console.log(```
      create table student(
        id int primary key,
        name text
      )
    ```)
  }
}
</pre>

This will output the template with margins stripped:

<pre>
create table student(
  id int primary key,
  name text
)
</pre>

Custom expressions would work without any special handling:

<pre>
const query = sql```
  select *
  from studients
  where name = ${name}
```
</pre>

We can also avoid the need for escaping backticks when they're needed inside the template:

<pre>
const printBashCommand = () => {
  console.log(```
    ./some-bash-script.sh `ls`
  ```);
};
</pre>

Using more backticks allows for triple-backticks inside templates without escaping:

<pre>
const getMarkdown = () => {
  return `````
    # blah blah

    ```json
    { "foo": "bar" }
    ```

    some _more_ *markdown*
  `````;
};
</pre>

## In other languages

- *Java* - [text blocks](https://openjdk.java.net/jeps/378) using triple-quotes
- *Scala* - [multiline strings](https://docs.scala-lang.org/overviews/scala-book/two-notes-about-strings.html) using triple-quotes and `.stripMargin`
- *Python* - [multiline strings](https://docs.python.org/3/library/textwrap.html) using triple-quotes to avoid escaping and `textwrap.dedent`
- *Jsonnet* - [text blocks](https://jsonnet.org/learning/tutorial.html) with `|||` as a delimiter

## Implementations

A very basic POC polyfill for babel is implemented [in this repo](./packages/babel-plugin-proposal-multi-backtick-templates/plugin.js), mostly as a strawman to make it easier to discuss the particulars of how indenting should work - so it's as-yet unpublished.

See the [tests](./packages/babel-plugin-proposal-multi-backtick-templates/plugin.test.js) for proposed functionality - that is, how triple-backticks can be transpiled to current ecmascript. These don't include any parsing changes, so there are no examples of unescaped backticks inside templates.

## TODO

- babel parser plugin allowing for unescaped backticks
- a patch to typescript library types, since typescript will get upset about trying to use template literal tag as a template literal tag.

## Q&A

### Is this backwards compatible?

This could be partially implemented with no syntax changes, since it's technically already valid syntax:

<pre>
```abc```
</pre>

Is equivalent to

<pre>
((``)`abc`)``
</pre>

Where the empty-strings are being used as tagged template functions. i.e. when run, this code will try to use the empty string

<pre>
(``)
</pre>

as an template tag, passing in `'abc'`, the return value of which is then used as another es string tag which receives the empty string. Obviously, none of that will currently work at runtime, because an empty string is not a function. So no functioning code should be affected by this change.

Some parsing changes would be needed to allow for unescaped backticks inside triple-backticked templates.

### Why not use a library?

To summarise the [problem](#problem) section above:
- avoid a dependency for the  desired behaviour of the vast majority of multiline strings (dedent has millions of downloads per week)
- make code snippets more portable
- improved performance
- better discoverability - the feature can be documented publicly, and used in code samples which wouldn't otherwise rely on a package like dedent, which is on major version 0 without an update in three years
- establish a standard that can be adopted by JSON-superset implementations like [json5](https://npmjs.com/package/json5)
- give code generators a way to output readable code with correct indentation properties (e.g. jest inline snapshots)
- support "dedenting" tagged template literal functions with customized expression parameter behaviour (e.g. [slonik](https://npmjs.com/package/slonik)
- allow formatters/linters to safely enforce code style without needing to be coupled to the runtime behaviour of multiple libraries in combination

<!--

# template-for-proposals

A repository template for ECMAScript proposals.

## Before creating a proposal

Please ensure the following:
  1. You have read the [process document](https://tc39.github.io/process-document/)
  1. You have reviewed the [existing proposals](https://github.com/tc39/proposals/)
  1. You are aware that your proposal requires being a member of TC39, or locating a TC39 delegate to "champion" your proposal

## Create your proposal repo

Follow these steps:
  1.  Click the green ["use this template"](https://github.com/tc39/template-for-proposals/generate) button in the repo header. (Note: Do not fork this repo in GitHub's web interface, as that will later prevent transfer into the TC39 organization)
  1.  Go to your repo settings “Options” page, under “GitHub Pages”, and set the source to the **master branch** (and click Save, if it does not autosave this setting)
      1. check "Enforce HTTPS"
      1. On "Options", under "Features", Ensure "Issues" is checked, and disable "Wiki", and "Projects" (unless you intend to use Projects)
      1. Under "Merge button", check "automatically delete head branches"
<!--
  1.  Avoid merge conflicts with build process output files by running:
      ```sh
      git config --local --add merge.output.driver true
      git config --local --add merge.output.driver true
      ```
  1.  Add a post-rewrite git hook to auto-rebuild the output on every commit:
      ```sh
      cp hooks/post-rewrite .git/hooks/post-rewrite
      chmod +x .git/hooks/post-rewrite
      ```
-->
<!--
  1.  ["How to write a good explainer"][explainer] explains how to make a good first impression.

      > Each TC39 proposal should have a `README.md` file which explains the purpose
      > of the proposal and its shape at a high level.
      >
      > ...
      >
      > The rest of this page can be used as a template ...

      Your explainer can point readers to the `index.html` generated from `spec.emu`
      via markdown like

      ```markdown
      You can browse the [ecmarkup output](https://ACCOUNT.github.io/PROJECT/)
      or browse the [source](https://github.com/ACCOUNT/PROJECT/blob/master/spec.emu).
      ```

      where *ACCOUNT* and *PROJECT* are the first two path elements in your project's Github URL.
      For example, for github.com/**tc39**/**template-for-proposals**, *ACCOUNT* is "tc39"
      and *PROJECT* is "template-for-proposals".


## Maintain your proposal repo

  1. Make your changes to `spec.emu` (ecmarkup uses HTML syntax, but is not HTML, so I strongly suggest not naming it ".html")
  1. Any commit that makes meaningful changes to the spec, should run `npm run build` and commit the resulting output.
  1. Whenever you update `ecmarkup`, run `npm run build` and commit any changes that come from that dependency.
  
  [explainer]: https://github.com/tc39/how-we-work/blob/master/explainer.md
