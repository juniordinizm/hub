const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos);/g;

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};

export const decodeXmlEntities = (value: string): string =>
  value.replace(XML_ENTITY_PATTERN, (entity) => XML_ENTITIES[entity] ?? entity);
