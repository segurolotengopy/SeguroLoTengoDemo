/**
 * Tests del repositorio de OTP contra un DynamoDB falso en memoria
 * (`fake-dynamo-document-client.ts`), sin red ni credenciales de AWS.
 * Cubre la misma regla de negocio inviolable #1 que ya ejercita
 * `src/ports/__tests__/otp-provider.contract.ts` sobre el futuro
 * `OtpProvider`, pero a nivel de repositorio: 6 dígitos, uso único,
 * vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos — y
 * la regla #2 (nunca se persiste el código en claro).
 */
import { describe, expect, it } from "vitest";
import { crearOtpRepositoryDynamoDb, COOLDOWN_REENVIO_MS, INTENTOS_MAXIMOS_OTP, VIGENCIA_OTP_MS } from "../otp-repository";
import { crearFakeDynamoDocumentClient } from "./fake-dynamo-document-client";

const PEPPER_DE_PRUEBA = "pepper-de-test-no-real";
const AHORA = "2026-01-01T00:00:00.000Z";
const DESTINO = "+595981000000";

function crearRepo() {
  const { documentClient, tabla } = crearFakeDynamoDocumentClient();
  const repo = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: "tabla-de-test",
    obtenerPepper: async () => PEPPER_DE_PRUEBA,
  });
  return { repo, tabla };
}

describe("OtpRepository (DynamoDB, con cliente falso)", () => {
  it("crea un OTP de 6 dígitos y lo verifica con éxito", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    expect(creado.codigo).toMatch(/^\d{6}$/);

    const verificacion = await repo.verificarCodigo(creado.otpId, creado.codigo, AHORA);
    expect(verificacion).toEqual({ ok: true });
  });

  it("nunca persiste el código en claro (regla #2): solo el hash queda en la tabla", async () => {
    const { repo, tabla } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const itemCrudo = [...tabla.values()][0] as Record<string, unknown>;
    expect(JSON.stringify(itemCrudo)).not.toContain(creado.codigo);
    expect(typeof itemCrudo.codigoHash).toBe("string");
    expect(itemCrudo.codigoHash).not.toBe(creado.codigo);
  });

  it("obtener() nunca expone el hash del código", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const registro = await repo.obtener(creado.otpId);
    expect(registro).not.toBeNull();
    expect(registro).not.toHaveProperty("codigoHash");
  });

  it("un código incorrecto informa intentos restantes, y el cuarto intento queda agotado", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const primero = await repo.verificarCodigo(creado.otpId, "000000", AHORA);
    expect(primero).toEqual({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: INTENTOS_MAXIMOS_OTP - 1 });

    await repo.verificarCodigo(creado.otpId, "000000", AHORA);
    const tercero = await repo.verificarCodigo(creado.otpId, "000000", AHORA);
    expect(tercero).toEqual({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 0 });

    const cuarto = await repo.verificarCodigo(creado.otpId, "000000", AHORA);
    expect(cuarto).toEqual({ ok: false, motivo: "INTENTOS_AGOTADOS" });

    // Ni siquiera con el código correcto se puede verificar tras agotar intentos.
    const conCodigoCorrecto = await repo.verificarCodigo(creado.otpId, creado.codigo, AHORA);
    expect(conCodigoCorrecto).toEqual({ ok: false, motivo: "INTENTOS_AGOTADOS" });
  });

  it("un OTP vencido no puede verificarse aunque el código sea correcto", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const tarde = new Date(new Date(AHORA).getTime() + VIGENCIA_OTP_MS + 1000).toISOString();
    const verificacion = await repo.verificarCodigo(creado.otpId, creado.codigo, tarde);

    expect(verificacion).toEqual({ ok: false, motivo: "EXPIRADO" });
  });

  it("un OTP ya usado no puede reutilizarse (uso único)", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const primera = await repo.verificarCodigo(creado.otpId, creado.codigo, AHORA);
    expect(primera).toEqual({ ok: true });

    const segunda = await repo.verificarCodigo(creado.otpId, creado.codigo, AHORA);
    expect(segunda).toEqual({ ok: false, motivo: "YA_UTILIZADO" });
  });

  it("verificar un otpId inexistente devuelve NO_ENCONTRADO", async () => {
    const { repo } = crearRepo();
    const verificacion = await repo.verificarCodigo("no-existe", "123456", AHORA);
    expect(verificacion).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
  });

  it("dos OTP del mismo expediente (celular y correo) tienen ids y códigos independientes", async () => {
    const { repo } = crearRepo();
    const celular = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });
    const correo = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CORREO", canal: "EMAIL", destino: "persona@correo.com", ahora: AHORA });

    expect(celular.otpId).not.toBe(correo.otpId);
    expect(celular.codigo).not.toBe(correo.codigo);

    // Verificar el código del OTP de correo contra el de celular debe fallar.
    const cruzado = await repo.verificarCodigo(celular.otpId, correo.codigo, AHORA);
    expect(cruzado.ok).toBe(false);
  });

  it("un reenvío antes de 60 segundos queda bloqueado", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const treintaSegundosDespues = new Date(new Date(AHORA).getTime() + 30_000).toISOString();
    const reenvio = await repo.registrarReenvio(creado.otpId, treintaSegundosDespues);

    expect(reenvio.ok).toBe(false);
    if (reenvio.ok) return;
    expect(reenvio.motivo).toBe("REENVIO_BLOQUEADO");
    if (reenvio.motivo === "REENVIO_BLOQUEADO") {
      expect(reenvio.segundosRestantes).toBeGreaterThan(0);
      expect(reenvio.segundosRestantes).toBeLessThanOrEqual(30);
    }
  });

  it("un reenvío después de 60 segundos rota el código, resetea intentos y extiende la vigencia", async () => {
    const { repo } = crearRepo();
    const creado = await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });
    await repo.verificarCodigo(creado.otpId, "000000", AHORA); // gasta un intento fallido

    const sesentaUnSegundosDespues = new Date(new Date(AHORA).getTime() + COOLDOWN_REENVIO_MS + 1000).toISOString();
    const reenvio = await repo.registrarReenvio(creado.otpId, sesentaUnSegundosDespues);

    expect(reenvio.ok).toBe(true);
    if (!reenvio.ok) return;
    expect(reenvio.codigo).not.toBe(creado.codigo);

    // El intento fallido de antes del reenvío no cuenta más (se resetea al rotar el código).
    const registro = await repo.obtener(creado.otpId);
    expect(registro?.intentos).toBe(0);

    // El código viejo ya no sirve (y este intento sí cuenta contra el nuevo cupo de 3)...
    const conCodigoViejo = await repo.verificarCodigo(creado.otpId, creado.codigo, sesentaUnSegundosDespues);
    expect(conCodigoViejo).toEqual({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: INTENTOS_MAXIMOS_OTP - 1 });

    // ...pero el nuevo sí funciona.
    const conCodigoNuevo = await repo.verificarCodigo(creado.otpId, reenvio.codigo, sesentaUnSegundosDespues);
    expect(conCodigoNuevo).toEqual({ ok: true });
  });

  it("reenviar un otpId inexistente devuelve NO_ENCONTRADO", async () => {
    const { repo } = crearRepo();
    const reenvio = await repo.registrarReenvio("no-existe", AHORA);
    expect(reenvio).toEqual({ ok: false, motivo: "NO_ENCONTRADO" });
  });

  it("el atributo TTL (expiresAt) queda seteado en el futuro, en epoch de segundos", async () => {
    const { repo, tabla } = crearRepo();
    await repo.crear({ expedienteId: "EXP-1", proposito: "VERIFICACION_CELULAR", canal: "WHATSAPP", destino: DESTINO, ahora: AHORA });

    const item = [...tabla.values()][0] as Record<string, unknown>;
    const ahoraEpoch = Math.floor(new Date(AHORA).getTime() / 1000);
    expect(typeof item.expiresAt).toBe("number");
    expect(item.expiresAt as number).toBeGreaterThan(ahoraEpoch);
  });
});
