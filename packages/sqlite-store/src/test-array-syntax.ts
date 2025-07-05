// Test file to verify array-type rule
const wrongSyntax: Array<string> = ['test']; // Should trigger error
const correctSyntax: Array<string> = ['test']; // Should be fine

export { wrongSyntax, correctSyntax };
