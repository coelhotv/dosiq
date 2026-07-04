/**
 * Branded UIDs para identidade de paciente/cuidador (épico 009 — Modo Cuidador).
 * Branding em compile-time impede passar CaregiverUid onde PatientUid é esperado.
 */

declare const patientUidBrand: unique symbol;
declare const caregiverUidBrand: unique symbol;

export type PatientUid = string & { readonly [patientUidBrand]: true };
export type CaregiverUid = string & { readonly [caregiverUidBrand]: true };

export function asPatientUid(uid: string): PatientUid {
  return uid as PatientUid;
}

export function asCaregiverUid(uid: string): CaregiverUid {
  return uid as CaregiverUid;
}
