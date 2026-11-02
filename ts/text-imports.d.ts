// Import-attribute text modules (esbuild inlines *.css into the bundle;
// *.html is declared in server/types/html.d.ts).
declare module "*.css" {
  const value: string;
  export default value;
}
