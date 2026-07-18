export const readBannerFileSelection = (files: File[] | FileList): File => {
  if (files.length !== 1) {
    throw new Error("Envie um banner por vez.");
  }

  const file = files[0];

  if (!file) {
    throw new Error("Selecione uma imagem para o banner.");
  }

  return file;
};
