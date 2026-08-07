export interface CertificateActionState {
  message?: string;
  status: "error" | "idle" | "success";
}

export const certificateActionInitialState: CertificateActionState = {
  status: "idle",
};
