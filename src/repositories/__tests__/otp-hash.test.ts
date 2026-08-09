import { describe, expect, it } from "vitest";
import { codigoCoincideConHash, generarCodigoOtp, hashOtpConPepper } from "../otp-hash";

describe("otp-hash", () => {
  it("genera códigos de 6 dígitos numéricos, con ceros a la izquierda si hace falta", () => {
    for (let i = 0; i < 200; i++) {
      const codigo = generarCodigoOtp();
      expect(codigo).toMatch(/^\d{6}$/);
    }
  });

  it("el mismo código con distinto pepper produce hashes distintos", () => {
    const a = hashOtpConPepper("123456", "pepper-a");
    const b = hashOtpConPepper("123456", "pepper-b");
    expect(a).not.toBe(b);
  });

  it("el hash nunca contiene el código en claro como substring", () => {
    const hash = hashOtpConPepper("123456", "pepper-de-prueba");
    expect(hash).not.toContain("123456");
  });

  it("codigoCoincideConHash es true solo con el código correcto y el pepper correcto", () => {
    const hash = hashOtpConPepper("654321", "pepper-correcto");
    expect(codigoCoincideConHash("654321", hash, "pepper-correcto")).toBe(true);
    expect(codigoCoincideConHash("000000", hash, "pepper-correcto")).toBe(false);
    expect(codigoCoincideConHash("654321", hash, "otro-pepper")).toBe(false);
  });
});
