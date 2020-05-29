/** @param {typeof import('@babel/core')} babel */
const plugin = ({types: t}) => {
  /** @typedef {import('@babel/core').types.TaggedTemplateExpression} TaggedTemplateExpression */
  /** @typedef {import('@babel/core').types.TemplateLiteral} TemplateLiteral */
  /** @typedef {import('@babel/core').types.Expression} Expression */
  /** @typedef {import('@babel/core').types.TemplateElement} TemplateElement */


  /** @param {object} literal */
  const isEmptyStringTemplateLiteral = literal => {
    return t.isTemplateLiteral(literal) && literal.quasis.length === 1 && literal.quasis[0].value.raw === ''
  }

  /**
   * Recursively finds the template literal in "the middle". e.g. for an input like
   * ```
   * `````foo bar ${baz}`````
   * ```
   * 
   * the output will be
   * 
   * ```
   * `foo bar ${baz}`
   * ```
   *
   * @param {TaggedTemplateExpression} node
   * @returns {{tag: Expression, quasi: TemplateLiteral}}
   */
  const extractInnerTemplate = (node, tailLength = 0) => {
    const {tag, quasi} = node
    if (isEmptyStringTemplateLiteral(quasi) && t.isTaggedTemplateExpression(tag)) {
      return extractInnerTemplate(tag, tailLength + 1)
    }

    /**
     * Recursively try to "balance" the tail of empty template literals by matching them with empty
     * template literals at the start of the template expression.
     * 
     * @param {Expression} stack 
     * @param {number} size 
     * @returns {{success: boolean, tag?: Expression}}
     */
    const balanceTail = (stack, size) => {
      if (size === 0) {
        if (t.isTaggedTemplateExpression(stack) && isEmptyStringTemplateLiteral(stack.quasi)) {
          // the "first" empty template literal is a template expression itself, e.g.
          // gql```query foo { bar }```
          return {success: true, tag: stack.tag}
        }
        return {success: isEmptyStringTemplateLiteral(stack)}
      }
      if (t.isTaggedTemplateExpression(stack) && isEmptyStringTemplateLiteral(stack.quasi)) {
        return balanceTail(stack.tag, size - 1)
      }
      return {success: false}
    }

    const balanced = balanceTail(tag, tailLength - 1)
    if (balanced.success) {
      return {tag: balanced.tag, quasi}
    }
    return undefined
  }

  /** @param {TemplateElement[]} quasis */
  const dedentQuasis = quasis => {
    const firstQuasiLines = quasis[0].value.raw.split(/\n/)
    if (firstQuasiLines[0] !== '') {
      throw Error(`Multi-backtick template literals must start with a newline`)
    }
    const firstSignificantLine = firstQuasiLines.find(Boolean) || ''
    const margin = firstSignificantLine.match(/^[\t ]*/)[0] || ''

    /** @param {string} str */
    const dedentString = str => str
      .split('\n')
      .map((line, i) => {
        if (line.startsWith(margin)) {
          return line.replace(margin, '')
        } else if (line !== '' && i > 0) {
          throw Error(`Multi-backtick template literals should have consistent margins`)
        }
        return line
      })
      .join('\n')

    return quasis.map((q, i) => {
      /** @param {string} str */
      const dedentAndTrim = str => {
        if (i === quasis.length - 1) {
          str = str.replace(/\r?\n[\t ]*$/, '')
        }
        if (i === 0) {
          str = str.replace(/^[\t ]*\r?\n/, '')
        }
        let dedented = dedentString(str)
        return dedented
      }

      return t.templateElement({
        raw: dedentAndTrim(q.value.raw),
        cooked: q.value.cooked && dedentAndTrim(q.value.cooked)
      }, q.tail)
    })
  }

  /** @param {TemplateLiteral} node */
  const dedentTemplateLiteral = ({quasis, expressions}) => {
    return t.templateLiteral(dedentQuasis(quasis), expressions)
  }

  return {
    name: 'multiBacktickTemplate',
    visitor: {
      TaggedTemplateExpression: {
        /** @param {import('@babel/core').NodePath<TaggedTemplateExpression>} path */
        enter(path) {
          const extracted = extractInnerTemplate(path.node)

          if (extracted) {
            const quasi = dedentTemplateLiteral(extracted.quasi)

            const replacement = extracted.tag ? t.taggedTemplateExpression(extracted.tag, quasi) : quasi

            // todo: add whitespace before/after to preserve line numbers?
            path.replaceWith(replacement)
          }
        }
      }
    }
  }
}

exports.default = plugin
