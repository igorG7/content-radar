import type { BriefState } from "@/lib/manifest";

/**
 * Quem pode baixar o pacote.
 *
 * Vive fora do componente porque a regra já foi escrita errada uma vez, e de um
 * jeito que ninguém veria: o botão aparecia só quando `handoffAt` estava
 * preenchido, isto é, **só para quem já tinha exportado antes**. Quem esquecesse
 * de exportar antes de aprovar perdia o pacote para sempre — que foi exatamente
 * o que aconteceu com o `2026-W35-001`.
 *
 * O comentário no componente dizia o contrário da condição, no mesmo arquivo:
 * "baixar continua disponível depois de publicado (…) o backend nunca impediu".
 * A intenção estava certa e escrita; a condição é que não seguia.
 *
 * Rejeitado é o único que fica de fora, e não por limite de interface: rejeitar
 * apaga a mídia, local e remota. O pacote apontaria para foto que não existe
 * mais, e entregar isso é pior que não entregar.
 */
export function podeExportar(estado: BriefState): boolean {
  return estado !== "rejeitado";
}
