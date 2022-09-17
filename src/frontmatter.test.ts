import {
  determineFrontmatterBounds,
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
