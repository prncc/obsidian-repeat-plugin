import {
  determineFrontmatterBounds,
  determineInlineFieldBounds,
  replaceOrInsertField,
} from './frontmatter';

const validFrontmatter = `
a: 1
b :2
c : 3

d:4
d:5
e:
`;
const validContent = `---${validFrontmatter}---`;
const validContentWithDanglingKey = `---${validFrontmatter}
key
---`;

describe('determineFrontmatterBounds', () => {
  test.concurrent.each([
    {
      testName: 'no trailing chars',
      content: validContent,
      hi: validFrontmatter.length + 4 - 1,
    },
    {
      testName: 'trailing spaces',
      content: `${validContent}      `,
      hi: validFrontmatter.length + 4 - 1,
    },
    {
      testName: 'dangling key',
      content: validContentWithDanglingKey,
      hi: (validFrontmatter.length + 'key'.length + 2) + 4 - 1
    },
  ])('valid bounds - $testName', ({ content, hi }) => {
    const bounds = determineFrontmatterBounds(content);
    expect(bounds).toStrictEqual([4, hi]);
  });

  test.concurrent.each([
    {
      testName: 'unterminated yaml',
      content: `---${validFrontmatter}`,
    },
    {
      testName: 'incorrectly terminated yaml',
      content: `---${validFrontmatter}--`,
    },
  ])('null bounds - $testName', ({ content }) => {
    const bounds = determineFrontmatterBounds(content);
    expect(bounds).toBeNull();
  });

  test('with delimiters included', () => {
    const content = `---${validFrontmatter}---`;
    const bounds = determineFrontmatterBounds(content, true);
    expect(bounds).toStrictEqual([0, content.length]);
  });
});

describe('determineInlineFieldBounds', () => {
  test.concurrent.each([
    'one:two',
    'one: two',
    'one :two',
    'one : two',
    'one    :    two',
  ])('simple field bounds %s', (inlineField) => {
    const bounds = determineInlineFieldBounds(`${inlineField}\n`, 'one');
    expect(bounds).toStrictEqual([0, inlineField.length]);
  });

  test('repeated field', () => {
    const frontmatter = ['one: 1', 'one: 2\n'].join('\n');
    const bounds = determineInlineFieldBounds(frontmatter, 'one');
    expect(frontmatter.slice(...(bounds || []))).toBe('one: 2');
  })
});

describe('replaceOrInsertField', () => {
  test.concurrent.each([
    {
      testName: 'last',
      frontmatter: [
        'one: 1',
        'field :  value\n',
      ].join('\n'),
      expectedFrontmatter: [
        'one: 1',
        'field: new value\n',
      ].join('\n'),
    }, {
      testName: 'repeated',
      frontmatter: [
        'one: 1',
        'field: value',
        'field: second value',
        'two: 2\n',
      ].join('\n'),
      expectedFrontmatter: [
        'one: 1',
        'field: value',
        'field: new value',
        'two: 2\n',
      ].join('\n'),
    }, {
      testName: 'repeated',
      frontmatter: [
        'one: 1',
        'two: 2\n',
      ].join('\n'),
      expectedFrontmatter: [
        'one: 1',
        'two: 2',
        'field: new value\n',
      ].join('\n'),
    },
  ])('replace $testName', ({ frontmatter, expectedFrontmatter }) => {
    const newFrontmatter = replaceOrInsertField(frontmatter, 'field', 'new value');
    expect(newFrontmatter).toEqual(expectedFrontmatter);
  })
});
