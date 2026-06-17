const NAME_PARTS_PATTERN = /\s+/;

export const getInitials = (name: string): string => {
  const [first = "", second = ""] = name.trim().split(NAME_PARTS_PATTERN);
  return `${first.slice(0, 1)}${second.slice(0, 1) || first.slice(1, 2)}`
    .toUpperCase()
    .slice(0, 2);
};
