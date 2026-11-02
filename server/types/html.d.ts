// Import-attribute text modules (Nitro and esbuild inline *.html).
declare module "*.html" {
  const value: string;
  export default value;
}
