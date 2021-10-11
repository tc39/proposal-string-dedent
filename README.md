# String dedent

Champions: [@jridgewell](https://github.com/jridgewell), [@hemanth](https://github.com/hemanth)

Author: [@mmkal](https://github.com/mmkal)

Status: draft

[Original TC39 thread](https://es.discourse.group/t/triple-backtick-template-literal-with-indentation-support/337)

## Problem

The current syntax forces users to choose between strange-looking unindented template literals, template literals containing unwanted indentation, or relying on third-party dependencies to "fix" template margins. They also require escaping backticks, limiting the ability to put code samples inside templates for languages which include backticks (e.g. javascript/markdown/bash).

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

### Sensible-looking code, with unwanted indents in output string

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

This logs:

```sql

      create table student(
        id int primary key
        name text
      )
      
```

Note the newlines at the start and the end of the string, and a margin on each line.

### With a library

A commonly used library is [dedent](https://npmjs.com/package/dedent):

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

Now both the code and the resulting output look about right, but we had to add a runtime dependency. This makes what could be pure data less portable. You can no longer copy-paste snippets without installing an npm package, possibly installing the types too, then importing and using it. This solution also cannot be used in ecmascript-compatible data formats like [json5](https://npmjs.com/package/json5).

Similarly, [jest-inline-snapshots](https://jestjs.io/docs/en/snapshot-testing#inline-snapshots) automatically "dedent" literal snapshots at runtime. There is also a [babel plugin](https://www.npmjs.com/package/babel-plugin-dedent) which moves the "dedenting" to compile-time.

This presents a problem when template expression tags also need to be used:

```javascript
const raw = dedent`
  query foo {
    bar
  }
`;

gql`${raw}`; // <- this doesn't work right.
```

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
  
There are several other libraries which each have a very similar purpose (and each behave slightly differently). Some examples:
- https://www.npmjs.com/package/strip-indent
- https://www.npmjs.com/package/trim-margin
- https://www.npmjs.com/package/stripmargin
- https://www.npmjs.com/package/string-dedent

## Proposed solution

Allow specifying triple-, quintuple, or septuple, or any-odd-number-uple backtick-delimited literals, which behave almost the same as a regular single backticked template literal, with a few key differences:

- The string is automatically "dedented", along the lines of what the dedent library does. A simple strawman algorithm:
  - the first line (including the opening delimiter) is ignored
  - the last line (including the closing delimiter) is ignored if it contains only whitespace
  - the "margin" is calculated using the whitespace at the beginning of the first line after the opening delimiter
  - that margin is removed from the start of every line
- The opening delimiter must be immediately followed by a newline or the closing delimiter
- The closing delimiter should only contain whitespace between it and the previous newline
- Backticks inside the string don't need to be escaped

The examples above would be solved like this:

```javascript
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
```

This will output the template with margins stripped:

```sql
create table student(
  id int primary key,
  name text
)
```

Custom expressions would work without any special composition of tag template functions:

<pre lang="javascript">
const query = sql```
  select *
  from studients
  where name = ${name}
```
</pre>

We can also avoid the need for escaping backticks when they're needed inside the template:

```javascript
const printBashCommand = () => {
  console.log(```
    ./some-bash-script.sh `ls`
  ```);
};
```

Using more backticks allows for triple-backticks inside templates without escaping:

```javascript
const getMarkdown = () => {
  return `````
    # blah blah

    ```json
    { "foo": "bar" }
    ```

    some _more_ *markdown*
  `````;
};
```

The behavior when later lines lack the whitespace prefix of the first line, is not yet defined:

<pre lang="javascript">
const tbd = ```
  The first line starts with two spaces
but a later line doesn't.
```
</pre>

## In other languages

- *Java* - [text blocks](https://openjdk.java.net/jeps/378) using triple-quotes
- *Scala* - [multiline strings](https://docs.scala-lang.org/overviews/scala-book/two-notes-about-strings.html) using triple-quotes and `.stripMargin`
- *Python* - [multiline strings](https://docs.python.org/3/library/textwrap.html) using triple-quotes to avoid escaping and `textwrap.dedent`
- *Jsonnet* - [text blocks](https://jsonnet.org/learning/tutorial.html) with `|||` as a delimiter
- *Bash* - [`<<-` Heredocs](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_07_04)
- *Ruby* - [`<<~` Heredocs](https://www.rubyguides.com/2018/11/ruby-heredoc/)
- *Swift* - [multiline string literals](https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html#ID286) using triple-quotes - strips margin based on whitespace before closing delimiter
* _PHP_  - `<<<` [heredoc/nowdoc](https://wiki.php.net/rfc/flexible_heredoc_nowdoc_syntaxes#closing_marker_indentation)  The indentation of the closing marker dictates the amount of whitespace to strip from each line.

## Syntax Alternatives Considered

Some potential alternatives to the multi-backtick syntax:

- A built-in runtime method along the lines of the `dedent` library, e.g. `String.dedent`:
  - Pros:
    - Easier to implement
    - No new syntax
  - Cons:
    - Non-zero runtime impact (though less than a js library)
    - Open question of whether [isTemplateObject](https://github.com/tc39/proposal-array-is-template-object) would propagate to the output, and [whether this could introduce a security vulnerability](https://github.com/mmkal/proposal-multi-backtick-templates/pull/5#discussion_r441894983)
    - More verbose
    - Lends itself less well to ecmascript-compatible data formats like json5 and forks aiming at modern es features like [json6](https://github.com/d3x0r/JSON6), [jsox](https://github.com/d3x0r/JSOX), [jsonext](https://github.com/jordanbtucker/jsonext) and [ESON](https://github.com/mmkal/eson)
- Triple-backticks only (not five, or seven, or 2n+1):
  - Pros:
    - Simpler implementation and documentation
  - Cons:
    - Triple-backticks within templates would need to be escaped
- Using another character for dedentable templates, e.g. `|||`
  - Pros:
    - Should be easy to select a character which would be a syntax error currently, so the risk even of very contrived breaking changes could go to near-zero
    - Could match existing languages with similar features, e.g. jsonnet
    - More intuitive difference from single-backticks
  - Cons:
    - Less intuitive similarities to single-backticks, wouldn't be as obvious that tagged template literals should work

## Q&A

### Is this backwards compatible?

This could be partially implemented with no syntax changes, since it's technically already valid syntax:

<pre lang="javascript">
```abc```
</pre>

Is equivalent to

```javascript
((``)`abc`)``
```

Where the empty-strings are being used as tagged template functions. i.e. when run, this code will try to use the empty string

```javascript
(``)
```

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
- support "dedenting" tagged template literal functions with customized expression parameter behaviour (e.g. [slonik](https://npmjs.com/package/slonik))
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
