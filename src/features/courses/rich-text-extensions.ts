import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";

export const richTextExtensions = [
  StarterKit.configure({
    heading: {
      levels: [2, 3],
    },
    link: false,
  }),
  Link.configure({
    autolink: true,
    defaultProtocol: "https",
    openOnClick: false,
    protocols: ["http", "https"],
  }),
];
