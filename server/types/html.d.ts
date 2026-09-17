// Import-attribute text modules (Nitro inlines *.html into the bundle).
declare module "*.html" {
  const value: string;
  export default value;
}
