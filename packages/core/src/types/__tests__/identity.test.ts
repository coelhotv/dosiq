import { describe, expect, it } from 'vitest';
import {
  asCaregiverUid,
  asPatientUid,
  type ActiveContext,
  isManagedContext,
  isSelfContext,
  type CaregiverUid,
  type PatientUid,
} from '../index';

describe('branded identity types', () => {
  it('asPatientUid/asCaregiverUid produzem branded strings runtime-compatíveis', () => {
    const patientUid = asPatientUid('patient-1');
    const caregiverUid = asCaregiverUid('caregiver-1');

    expect(patientUid).toBe('patient-1');
    expect(caregiverUid).toBe('caregiver-1');
  });

  it('rejeita CaregiverUid onde PatientUid é esperado (compile-time)', () => {
    const caregiverUid = asCaregiverUid('caregiver-1');

    function requiresPatientUid(_uid: PatientUid): void {}

    // @ts-expect-error CaregiverUid não é atribuível a PatientUid
    requiresPatientUid(caregiverUid);
  });

  it('rejeita string crua onde PatientUid é esperado (compile-time)', () => {
    function requiresPatientUid(_uid: PatientUid): void {}

    // @ts-expect-error string não é PatientUid sem branding explícito
    requiresPatientUid('patient-1');
  });
});

describe('ActiveContext discriminated union', () => {
  it('isSelfContext/isManagedContext narrowam corretamente', () => {
    const selfContext: ActiveContext = { kind: 'self' };
    const managedContext: ActiveContext = {
      kind: 'managed',
      patientUid: asPatientUid('patient-1'),
    };

    expect(isSelfContext(selfContext)).toBe(true);
    expect(isManagedContext(managedContext)).toBe(true);

    if (isManagedContext(managedContext)) {
      expect(managedContext.patientUid).toBe('patient-1');
    }
  });

  it('rejeita kind desconhecido no discriminant (compile-time)', () => {
    // @ts-expect-error 'kind' deve ser 'self' | 'managed'
    const invalid: ActiveContext = { kind: 'unknown' };
    expect(invalid).toBeDefined();
  });
});
