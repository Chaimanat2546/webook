export interface CertificationSigner {
  name: string;
  position: string;
  signatureUrl: string;
}

export interface CertificationSnapshot {
  approver: CertificationSigner;
  companyStampUrl: string;
  issuer: CertificationSigner;
}

export function emptyCertificationSnapshot(): CertificationSnapshot {
  return {
    approver: { name: "", position: "", signatureUrl: "" },
    companyStampUrl: "",
    issuer: { name: "", position: "", signatureUrl: "" },
  };
}

const nullable = (value: string) => value || null;

export function certificationSnapshotToJson(snapshot: CertificationSnapshot) {
  return {
    approver: {
      name: nullable(snapshot.approver.name),
      position: nullable(snapshot.approver.position),
      signature_url: nullable(snapshot.approver.signatureUrl),
    },
    company_stamp_url: nullable(snapshot.companyStampUrl),
    issuer: {
      name: nullable(snapshot.issuer.name),
      position: nullable(snapshot.issuer.position),
      signature_url: nullable(snapshot.issuer.signatureUrl),
    },
  };
}
