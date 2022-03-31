# String dedent

Champions: [@jridgewell](https://github.com/jridgewell), [@hemanth](https://github.com/hemanth)

Author: [@mmkal](https://github.com/mmkal)

Status: [Stage 1](https://tc39.es/process-document/)

## Problem

When trying to embed formatted text (for instance, Markdown contents, or the
source text of a JS program) in JS code, developers are forced to make awkward
concessions for readability of the code or output. For instance, to make the
embedded text look consistent with the surrounding code, we'd write:

```javascript
class MyClass {
  print() {
    console.log(`
      create table student(
        id int primary key,
        name text
      )
    `);
  }
}
```

This outputs (using `^` to mark the beginning of a line and `·` to mark a leading space):

```sql
^
^······create table student(
^········id int primary key,
^········name text
^······)
^····
```

In order to for the output to look sensible, our code becomes illegible:

```javascript
class MyClass {
  print() {
    console.log(`create table student(
  id int primary key,
  name text
)`);
  }
}
```

This outputs a sensible:

```sql
create table student(
  id int primary key,
  name text
)
```

### With a library

It's possible to write sensible code and have sensible output with the help of
[libraries](https://www.npmjs.com/search?ranking=popularity&q=dedent). 

```javascript
import dedent from 'dedent'

class MyClass {
  print() {
    console.log(dedent`
      create table student(
        id int primary key,
        name text
      )
    `);
  }
}
```

This outputs the sensible:

```sql
create table student(
  id int primary key,
  name text
)
```

However, these libraries incur a runtime cost, and are subtly inconsistent with
they way they perform "dedenting". The most popular package is stagnant without
bug fixes and has problematic interpreting of the Template Object's `.raw`
array, and none are able to pass the dedented text to tag template functions.

```javascript
pythonInterpreter`
  print('Hello Python World')
`; // IndentationError: unexpected indent

const dedented = dedent`
  print('Hello Python World')
`;

pythonInterpreter`${dedented}`; // <- this doesn't work right.
```

Additionally, even if a userland library were to support passing to tagged
templates, the array would not be a true Template Object in proposals like
[`Array.isTemplateObject`](https://github.com/tc39/proposal-array-is-template-object).
This harms the ability of tagged templates functions to differentiate dedented
templates that exist in the actual program source text (and ascribe ascribe a
higher trust level to) vs a dynamically generated string (which may contain a
user generated exploit string).

## Proposed solution

Implement a `String.dedent` tag template function, for a tagged template
literal behaving almost the same as a regular single backticked template
literal, with a few key differences:

- The opening line (everything immediately right of the opening `` ` ``) must
  contain only a literal newline char.
- The opening line's literal newline is removed.
- The closing line (everything immediately to the left of the closing `` ` ``)
  may contain whitespace, but the whitespace is removed.
- The closing line's preceding literal newline char is removed.
- Lines which only contain whitespace are emptied.
- The "common indentation" of all non-empty content lines (lines that are not the
  opening or closing) are calculated.
- That common indentation is removed from the start of every line.

Play around with a [REPL](https://output.jsbin.com/wiwovot/quiet) implementation.

The examples above would be solved like this:

```javascript
class MyClass {
  print() {
    console.log(String.dedent`
      create table student(
        id int primary key,
        name text
      )
    `);
  }
}
```

This outputs the sensible:

```sql
create table student(
  id int primary key,
  name text
)
```

Expressions can be directly supported, as well as composition with
another tagged template function:

```javascript
const message = 'Hello Python World';
String.dedent(pythonInterpreter)`
  print('${message}')
`;
```

## In other languages

- *Java* - [text blocks](https://openjdk.java.net/jeps/378) using triple-quotes.
- *Scala* - [multiline strings](https://docs.scala-lang.org/overviews/scala-book/two-notes-about-strings.html)
  using triple-quotes and `.stripMargin`.
- *Python* - [multiline strings](https://docs.python.org/3/library/textwrap.html) using triple-quotes
  to avoid escaping and `textwrap.dedent`.
- *Jsonnet* - [text blocks](https://jsonnet.org/learning/tutorial.html) with `|||` as a delimiter.
- *Bash* - [`<<-` Heredocs](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#tag_18_07_04).
- *Ruby* - [`<<~` Heredocs](https://www.rubyguides.com/2018/11/ruby-heredoc/).
- *Swift* - [multiline string literals](https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html#ID286)
  using triple-quotes - strips margin based on whitespace before closing
  delimiter.
- _PHP_  - `<<<` [heredoc/nowdoc](https://wiki.php.net/rfc/flexible_heredoc_nowdoc_syntaxes#closing_marker_indentation)
  The indentation of the closing marker dictates the amount of whitespace to
  strip from each line.

## Q&A

### Why not use a library?

To summarise the [problem](#problem) section above:
- avoid a dependency for the  desired behaviour of the vast majority of
  multiline strings (dedent has millions of downloads per week).
- avoiding inconsistencies between the multiple current implementations.
- improved performance.
- better discoverability - the feature can be documented publicly, and used in
  code samples which wouldn't otherwise rely on a package like dedent.
- give code generators a way to output readable code with correct indentation
  properties (e.g. jest inline snapshots).
- support "dedenting" tagged template literal functions with customized
  expression parameter behaviour (e.g.  [slonik](https://npmjs.com/package/slonik)).
- allow formatters/linters to safely enforce code style without needing to be
  coupled to the runtime behaviour of multiple libraries in combination.


## Additional Links

- [Original TC39 thread](https://es.discourse.group/t/triple-backtick-template-literal-with-indentation-support/337)
- [2020-09 Committee Meeting](https://github.com/tc39/notes/blob/HEAD/meetings/2020-09/sept-23.md#stringdedent-for-stage-1)
