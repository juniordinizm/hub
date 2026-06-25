import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";

const sharedStarterKit = StarterKit.configure({
  heading: {
    levels: [2, 3],
  },
  link: false,
});

const sharedLink = Link.configure({
  autolink: true,
  defaultProtocol: "https",
  openOnClick: false,
  protocols: ["http", "https"],
});

/**
 * Extensions usadas no editor interativo (admin).
 * Inclui Placeholder e Typography para melhor UX de escrita.
 */
export const editorExtensions = [
  sharedStarterKit,
  sharedLink,
  Placeholder.configure({
    placeholder: "Escreva o conteudo da aula...",
  }),
  Typography,
];

/**
 * Extensions usadas no renderer server-side (aluno).
 * Sem Placeholder e Typography pois nao sao necessarios para renderizacao.
 */
export const rendererExtensions = [sharedStarterKit, sharedLink];
