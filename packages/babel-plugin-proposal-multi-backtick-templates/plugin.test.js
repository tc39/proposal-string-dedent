const pluginTester  = require('babel-plugin-tester').default
const shimMultiBacktickPlugin = require('./plugin').default

pluginTester({
  plugin: shimMultiBacktickPlugin,
  tests: [
    {
      title: 'dedents',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
      yaml:
        is:
          supported: nicely
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
  is:
    supported: nicely\`);
  }
}
`,
    },
    {
      title: 'dedents with tabs',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
\t\t\tyaml:
\t\t\t\tis:
\t\t\t\t\tsupported: nicely
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
\tis:
\t\tsupported: nicely\`);
  }
}
`,
    },
    {
      title: 'dedents with tabs for source indent and spaces for template indent',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
\t\t\tyaml:
\t\t\t  is:
\t\t\t    supported: nicely
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
  is:
    supported: nicely\`);
  }
}
`,
    },
    {
      title: 'dedents with spaces for source indent and tabs for template indent',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
      yaml:
      \tis:
      \t\tsupported: nicely
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
\tis:
\t\tsupported: nicely\`);
  }
}
`,
    },
    {
      title: 'handles quintuple-backtick',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`\`\`
      yaml:
        is:
          supported: nicely
    \`\`\`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
  is:
    supported: nicely\`);
  }
}
`,
    },
    {
      title: 'handles septuple-backtick',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`\`\`\`\`
      yaml:
        is:
          supported: nicely
    \`\`\`\`\`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
  is:
    supported: nicely\`);
  }
}
`,
    },
    {
      title: 'backticks with variables',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`\`\`
      yaml:
        is:
          supported: \${nicely}
    \`\`\`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
  is:
    supported: \${nicely}\`);
  }
}
`,
    },
    {
      title: 'tagged templates',
      code: `
class MyClass {
  print() {
    console.log(sql\`\`\`
      select *
      from abc
      where id = \${something}
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(sql\`select *
from abc
where id = \${something}\`);
  }
}
`,
    },
    {
      title: 'handles backticks',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
      yaml:
        with:
          backticks: '\\\`'
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`yaml:
  with:
    backticks: '\\\`'\`);
  }
}
`
    },
    {
      title: 'tagged templates with more than three backticks and newlines in middle of template',
      code: `
class MyClass {
  print() {
    console.log(sql\`\`\`\`\`\`\`\`\`
      select *
      from abc
      where id = \${something}
      \tand name = \${somethingElse}
      \tand another_column = \${yetAnotherThing}
      limit \${limit}
    \`\`\`\`\`\`\`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(sql\`select *
from abc
where id = \${something}
\tand name = \${somethingElse}
\tand another_column = \${yetAnotherThing}
limit \${limit}\`);
  }
}
`,
    },
    {
      title: 'tagged templates with more than three backticks and newlines in middle of template',
      code: `
class MyClass {
  print() {
    console.log(sql\`\`\`\`\`\`\`\`\`
      select *
      from abc
      where id = \${something} and name = \${somethingElse}
      \tand another_column = \${yetAnotherThing}
      limit \${limit}
    \`\`\`\`\`\`\`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(sql\`select *
from abc
where id = \${something} and name = \${somethingElse}
\tand another_column = \${yetAnotherThing}
limit \${limit}\`);
  }
}
`,
    },
    {
      title: 'errors when some lines have smaller margins than the first line',
      code: `
class MyClass {
  print() {
  console.log(\`\`\`
    strings:
      with:
  inconsistent:
    margins: not supported
  \`\`\`);
  }
}
`,
      error: /Multi-backtick template literals should have consistent margins/
    },
    {
      title: 'Leading newlines',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`

      yaml:
        with:
          leading:
            newlines: supported
    \`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`
yaml:
  with:
    leading:
      newlines: supported\`);
  }
}
`
    },
    {
      title: 'Multi-backtick template literals with whitespace following backticks',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`${' '}
      backticks
      followed by whitespace
    \`\`\`);
  }
}
`,
      error: /Multi-backtick template literals must start with a newline/
    },
    {
      title: `Even numbers of backticks aren't supported`,
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
      abc
    \`\`\`\`);
  }
}
`,
      // this is just a babel parse error; the test is here to explicitly show that even numbers aren't supported.
      error: /Unterminated template/,
    },
    {
      title: 'Multi-backtick template literals with no whitespace before closing backticks',
      code: `
class MyClass {
  print() {
    console.log(\`\`\`
      text
      not followed by newline\`\`\`);
  }
}
`,
      output: `
class MyClass {
  print() {
    console.log(\`text
not followed by newline\`);
  }
}
`,
    },
  ],
})
