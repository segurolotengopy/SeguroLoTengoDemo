import { describe, expect, it } from "vitest";
import { aEpochSegundos, claveEvidencia, claveExpediente, claveOtp, prefijoEvidenciaDeExpediente } from "../claves-tabla-unica";

describe("claves-tabla-unica", () => {
  it("la clave de expediente usa el mismo prefijo de partición que sus evidencias", () => {
    const clave = claveExpediente("EXP-1");
    expect(clave.pk).toBe("EXPEDIENTE#EXP-1");
    expect(clave.pk).toBe(prefijoEvidenciaDeExpediente("EXP-1"));
  });

  it("el sort key de evidencia ordena por fecha antes que por id", () => {
    const a = claveEvidencia("EXP-1", "EVID-Z", "2026-01-01T00:00:00.000Z");
    const b = claveEvidencia("EXP-1", "EVID-A", "2026-01-01T00:05:00.000Z");

    expect(a.sk < b.sk).toBe(true);
  });

  it("el OTP vive en su propia partición, no anidado bajo el expediente", () => {
    const clave = claveOtp("OTP-1");
    expect(clave.pk).toBe("OTP#OTP-1");
    expect(clave.pk).not.toContain("EXPEDIENTE");
  });

  it("aEpochSegundos convierte ISO a epoch en segundos (no milisegundos)", () => {
    expect(aEpochSegundos("1970-01-01T00:00:10.000Z")).toBe(10);
  });
});
