export const shouldInstallGitHooks = ({
  ci,
  gitMetadataExists,
  vercel,
}: {
  ci: boolean;
  gitMetadataExists: boolean;
  vercel: boolean;
}): boolean => gitMetadataExists && !ci && !vercel;
