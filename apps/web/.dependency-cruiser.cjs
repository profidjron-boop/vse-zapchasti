/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: { path: "^src" },
      to: { circular: true },
    },
    {
      name: "no-admin-to-public-cross-import",
      severity: "warn",
      from: { path: "^src/app/admin" },
      to: { path: "^src/app/(parts|service|about|contacts|favorites|cart)" },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
    doNotFollow: {
      path: "node_modules",
    },
    includeOnly: "^src",
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
    },
  },
};
