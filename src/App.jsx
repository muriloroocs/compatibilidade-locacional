
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import html2pdf from 'html2pdf.js';

/* =========================================================================
   CAMADA DE REGRAS (mock de "banco de dados" de regras de uso do solo)
   -------------------------------------------------------------------------
   Fonte: dados reais fornecidos pelo usuário —
     • Lei Complementar nº 341/2018, Anexo 8.1 (Categorias de Uso por
       Zonas e Eixos de Adensamento) → ZONAS (categorias permitidas por zona)
     • Lei Complementar nº 74/2005, alterada pela LC 373/2019, Anexo V
       (Compatibilidade Locacional) → CATEGORY_INFO (largura mínima da via
       e infraestrutura exigida por categoria)
   Toda a lógica de conformidade parte DAQUI — nada é fixado na interface.
   Para adicionar/corrigir uma zona, categoria ou requisito, basta editar
   os objetos abaixo (ou, no futuro, popular via API/BD).
   ========================================================================= */

// Grupos de categoria (conforme a própria estrutura do Anexo 8.1)
const GRUPOS_CATEGORIA = {
  R: 'Residencial', V: 'Comércio Varejista', A: 'Comércio Atacadista',
  S: 'Serviços', I: 'Industrial', L: 'Loteamento', E: 'Especial',
};
function grupoDaCategoria(cat) {
  const letra = norm(cat).replace(/[0-9].*$/, '');
  return GRUPOS_CATEGORIA[letra] || 'Outros';
}

// Todas as zonas de uso do solo (Anexo 8.1) e as categorias permitidas em cada uma,
// já separadas pelos mesmos grupos usados na lei (facilita montar a "ficha" no documento).
const ZONAS = [
  { code: 'Z1', label: 'Z1', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V8', 'V9', 'V11'], A: ['A1', 'A2'],
    S: ['S1', 'S3', 'S4', 'S5', 'S6', 'S7', 'S10', 'S11', 'S12', 'S13', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3'], L: ['L1', 'L2', 'L3', 'L5'], E: ['E1', 'E2', 'E3', 'E4', 'E10', 'E13', 'E19', 'E20'] } },
  { code: 'Z2', label: 'Z2', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V8', 'V9', 'V11'], A: ['A1', 'A2'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S10', 'S11', 'S12', 'S13', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3'], L: ['L1', 'L2', 'L3', 'L5'], E: ['E1', 'E2', 'E3', 'E4', 'E8', 'E13', 'E19', 'E20'] } },
  { code: 'Z3', label: 'Z3', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5'], L: ['L1', 'L2', 'L3', 'L5'], E: ['E1', 'E2', 'E3', 'E4', 'E8', 'E10', 'E11', 'E13', 'E18', 'E19', 'E20'] } },
  { code: 'Z4', label: 'Z4', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5'], L: ['L1', 'L2', 'L3', 'L5'], E: ['E1', 'E2', 'E3', 'E4', 'E7', 'E8', 'E10', 'E11', 'E12', 'E13', 'E18', 'E19', 'E20', 'E21'] } },
  { code: 'Z5', label: 'Z5', grupos: {
    R: ['R1', 'R2'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5'], L: ['L1', 'L2', 'L3', 'L5'], E: ['E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E11', 'E13', 'E14', 'E16', 'E17', 'E18', 'E19', 'E20'] } },
  { code: 'ZC', label: 'ZC', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5'], L: ['L1', 'L2', 'L3', 'L5'], E: ['E1', 'E2', 'E3', 'E4', 'E7', 'E8', 'E13', 'E18', 'E19', 'E20'] } },
  { code: 'ZEIE', label: 'ZEIE', grupos: {
    R: ['R1'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S11', 'S12', 'S19', 'S20'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9'], L: ['L4'], E: ['E4', 'E5', 'E6', 'E7', 'E13', 'E15', 'E16', 'E21'] } },
  { code: 'EA1', label: 'EA1', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S10', 'S11', 'S13', 'S15', 'S17', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5'], L: [], E: ['E4', 'E5', 'E13', 'E18', 'E19'] } },
  { code: 'EA2', label: 'EA2', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S13', 'S14', 'S15', 'S16', 'S17', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'], L: [], E: ['E4', 'E5', 'E6', 'E7', 'E8', 'E11', 'E13', 'E17', 'E18', 'E19', 'E20'] } },
  { code: 'EA3', label: 'EA3', grupos: {
    R: ['R1', 'R2'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S13', 'S14', 'S15', 'S16', 'S17', 'S20'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9'], L: [], E: ['E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E13', 'E17', 'E18', 'E19'] } },
  { code: 'ANHANDUI', label: 'Distrito de Anhanduí', grupos: {
    R: ['R1', 'R2', 'R3'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5'], L: ['L1', 'L2', 'L3', 'L4', 'L5'], E: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E13'] } },
  { code: 'EXPANSAO', label: 'Zonas de Expansão Urbana e Rural', grupos: {
    R: ['R1'], V: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'], A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
    S: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20'],
    I: ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9'], L: ['L6', 'L7'], E: ['E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E19', 'E20', 'E21'] } },
];
const ZONA_POR_CODIGO = Object.fromEntries(ZONAS.map((z) => [z.code, z]));

// Lista achatada de todas as categorias permitidas por zona (para checar conformidade rapidamente)
function categoriasPermitidasNaZona(zonaCode) {
  const z = ZONA_POR_CODIGO[norm(zonaCode)];
  if (!z) return null;
  return Object.values(z.grupos).flat();
}

// Notas do Anexo V (reduções de exigência conforme porte do empreendimento)
const NOTAS_ANEXO_V = {
  1: 'Em empreendimentos com área construída ≤ 2.500m², a faixa de domínio obrigatória da via de acesso terá a dimensão mínima reduzida para até 18m.',
  2: 'Em empreendimentos com área construída ≤ 500m², a faixa de domínio obrigatória da via de acesso terá a dimensão mínima reduzida para até 15m.',
  3: 'Em empreendimentos com área construída ≤ 2.500m², a faixa de domínio obrigatória da via de acesso terá a dimensão mínima reduzida para até 15m.',
  4: 'Em empreendimentos com até 200 unidades habitacionais, a faixa de domínio obrigatória da via de acesso terá a dimensão mínima reduzida para até 15m.',
  5: 'Em empreendimentos com até 6 unidades habitacionais será dispensada a exigência quanto à largura da faixa de domínio da via de acesso.',
};

// Requisitos de compatibilidade locacional por categoria — LC 74/2005 alterada pela LC 373/2019, Anexo V.
// largura = dimensão mínima da faixa de domínio (m), null = "não exige". Colunas de infraestrutura
// exigida (E = exige) mantidas para uso futuro; hoje o formulário só coleta largura e pavimentação.
const CATEGORY_INFO = {
  R1:  { largura: null, agua: false, vias: false, drenagem: false, esgoto: false, energia: false },
  R2:  { largura: 12,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true, nota: 5 },
  R3:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  V1:  { largura: null, agua: true,  vias: false, drenagem: false, esgoto: false, energia: true },
  V2:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: false, energia: true },
  V3:  { largura: 12,   agua: true,  vias: false, drenagem: false, esgoto: false, energia: false },
  V4:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  V5:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  V6:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  V7:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true, nota: 2 },
  V8:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  V9:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  V10: { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  V11: { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  A1:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  A2:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  A3:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  A4:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  A5:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true, nota: 2 },
  A6:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  A7:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  A8:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  A9:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S1:  { largura: null, agua: false, vias: false, drenagem: false, esgoto: false, energia: false },
  S2:  { largura: 12,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  S3:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  S4:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  S5:  { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S6:  { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S7:  { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S8:  { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S9:  { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S10: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S11: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S12: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S13: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S14: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S15: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S16: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S17: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S18: { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S19: { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  S20: { largura: 18,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true, nota: 3 },
  S21: { largura: 15,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  I1:  { largura: null, agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  I2:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  I3:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  I4:  { largura: 18,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  I5:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  I6:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  I7:  { largura: 33,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  I8:  { largura: 33,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  I9:  { largura: 33,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E1:  { largura: 15,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  E2:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true, nota: 4 },
  E3:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E4:  { largura: null, agua: false, vias: false, drenagem: false, esgoto: false, energia: false },
  E5:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E6:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E7:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E8:  { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E9:  { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E10: { largura: 22,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true, nota: 1 },
  E11: { largura: 18,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true },
  E12: { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E13: { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E14: { largura: 18,   agua: true,  vias: false, drenagem: false, esgoto: true,  energia: true, nota: 2 },
  E15: { largura: null, agua: false, vias: false, drenagem: false, esgoto: false, energia: false },
  E16: { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: false },
  E17: { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E18: { largura: 33,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E19: { largura: 18,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E20: { largura: 22,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  E21: { largura: 33,   agua: true,  vias: true,  drenagem: true,  esgoto: true,  energia: true },
  // L1-L7 (Loteamento) não constam no Anexo V — regidos por legislação específica de parcelamento do solo.
};

// Todas as categorias conhecidas (para a busca/combobox do formulário), agrupadas como no Anexo 8.1
const CATEGORIAS_TODAS = (() => {
  const porGrupo = { R: 3, V: 11, A: 9, S: 21, I: 9, L: 7, E: 21 };
  const lista = [];
  Object.entries(porGrupo).forEach(([letra, max]) => {
    for (let n = 1; n <= max; n++) lista.push({ code: `${letra}${n}`, group: GRUPOS_CATEGORIA[letra] });
  });
  return lista;
})();

// Opções da zona para o combobox do formulário (Anexo 8.1)
const ZONA_OPTIONS = ZONAS.map((z) => ({ code: z.code, label: z.code === z.label ? '' : z.label }));

const STATUS = {
  CONFORME: 'CONFORME',
  NAO_CONFORME: 'NAO_CONFORME',
  PENDENTE: 'PENDENTE',
};

// Normaliza texto de categoria/zona digitado pelo usuário (trim + upper)
function norm(v) {
  return (v || '').toString().trim().toUpperCase();
}

function parseNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// Máscara da inscrição imobiliária de Campo Grande: XX.XX.XXX.XXX-X (11 dígitos).
// Formata progressivamente enquanto o usuário digita, ignorando qualquer caractere não numérico.
function maskInscricaoImobiliaria(raw) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 11);
  const p = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 7), digits.slice(7, 10), digits.slice(10, 11)];
  let out = p[0];
  if (p[1]) out += '.' + p[1];
  if (p[2]) out += '.' + p[2];
  if (p[3]) out += '.' + p[3];
  if (p[4]) out += '-' + p[4];
  return out;
}

/**
 * Motor de conformidade. Recebe os dados informados no formulário e
 * retorna { status, motivo }. Baseado nos dados reais dos dois anexos:
 * 1) a categoria precisa estar na lista de categorias permitidas da zona (Anexo 8.1);
 * 2) se permitida, a largura da via informada precisa atender ao mínimo exigido (Anexo V).
 */
function calcularConformidade({ zona, categoria, largura, pavimentacao, endereco }) {
  const z = norm(zona);
  const cat = norm(categoria);
  const via = (endereco || '').trim() || 'via de acesso ao imóvel';
  const zonaInfo = ZONA_POR_CODIGO[z];

  if (!z || !cat) {
    return { status: STATUS.PENDENTE, motivo: 'Informe a zona e a categoria de uso.' };
  }

  if (!zonaInfo) {
    return { status: STATUS.PENDENTE, motivo: `Zona "${z}" não consta no Anexo 8.1. Aguardando cadastro/análise.` };
  }

  const permitidas = categoriasPermitidasNaZona(z) || [];
  if (!permitidas.includes(cat)) {
    return { status: STATUS.NAO_CONFORME, motivo: `A categoria de uso ${cat} não consta entre as categorias permitidas para a Zona ${zonaInfo.label} (Lei Complementar nº 341/2018, Anexo 8.1).` };
  }

  const req = CATEGORY_INFO[cat];
  if (!req) {
    return { status: STATUS.PENDENTE, motivo: `A categoria ${cat} é permitida na zona, mas não consta no Anexo V (Compatibilidade Locacional) — sujeita a normas específicas.` };
  }

  if (req.largura) {
    const larguraInformada = parseNumero(largura);
    if (larguraInformada === null) {
      return { status: STATUS.PENDENTE, motivo: `Informe a largura da via (mínimo de ${req.largura}m exigido para ${cat}, Anexo V).` };
    }
    if (larguraInformada < req.largura) {
      return { status: STATUS.NAO_CONFORME, motivo: `Largura da via (${largura}m) inferior ao mínimo exigido de ${req.largura}m para a categoria ${cat} na ${via} (Lei Complementar nº 373/2019, Anexo V).${req.nota ? ' ' + NOTAS_ANEXO_V[req.nota] : ''}` };
    }
  }

  return { status: STATUS.CONFORME, motivo: `Categoria ${cat} permitida na Zona ${zonaInfo.label} e compatível com os requisitos de via de acesso exigidos.` };
}

function requisitoDaCategoria(categoria) {
  const cat = norm(categoria);
  return CATEGORY_INFO[cat] || null;
}

/* =========================================================================
   ÍCONES (SVG inline, sem dependência externa)
   ========================================================================= */
const Icon = ({ children, className = 'w-5 h-5', ...rest }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
    {children}
  </svg>
);
const IconLock = (p) => <Icon {...p}><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/></Icon>;
const IconLockOpen = (p) => <Icon {...p}><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 8.2-2.6"/></Icon>;
const IconEye = (p) => <Icon {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></Icon>;
const IconTrash = (p) => <Icon {...p}><path d="M4 7h16"/><path d="M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7"/><path d="M6.5 7 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10 11v6M14 11v6"/></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
const IconX = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>;
const IconAlert = (p) => <Icon {...p}><path d="M12 9v4"/><path d="M12 16.5h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></Icon>;
const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></Icon>;
const IconHome = (p) => <Icon {...p}><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/></Icon>;
const IconMap = (p) => <Icon {...p}><path d="M9 20 3 17.5V4.5L9 7m0 13 6-2.5m-6 2.5V7m6 10.5 6 2.5V6.5L15 4m0 13.5V4m0 0L9 7"/></Icon>;
const IconReport = (p) => <Icon {...p}><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 15.5h6M9 8.5h3"/></Icon>;
const IconUsers = (p) => <Icon {...p}><circle cx="9" cy="8" r="3.2"/><path d="M2.8 19a6.2 6.2 0 0 1 12.4 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.2"/><path d="M17 13.3a6.2 6.2 0 0 1 4.2 5.7"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4.8a7.7 7.7 0 0 0-1.7-1L15 3.5h-4l-.3 2.4a7.7 7.7 0 0 0-1.7 1l-2.4-.8-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-.8a7.7 7.7 0 0 0 1.7 1l.3 2.4h4l.3-2.4a7.7 7.7 0 0 0 1.7-1l2.4.8 2-3.4-2-1.5Z"/></Icon>;
const IconLogout = (p) => <Icon {...p}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></Icon>;
const IconMenu = (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>;
const IconPrinter = (p) => <Icon {...p}><path d="M7 8.5V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4.5"/><rect x="4.5" y="8.5" width="15" height="7.5" rx="1.5"/><rect x="7" y="14.5" width="10" height="6" rx="1"/></Icon>;
const IconDownload = (p) => <Icon {...p}><path d="M12 3.5v11.5"/><path d="M7.5 11l4.5 4.5L16.5 11"/><path d="M4.5 18.5h15"/></Icon>;
const IconChevron = (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>;
const IconChevronLeft = (p) => <Icon {...p}><path d="m15 6-6 6 6 6"/></Icon>;
const IconBuilding = (p) => <Icon {...p}><path d="M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"/><path d="M13 10h6a1 1 0 0 1 1 1v10"/><path d="M7.5 8.5h.01M10.5 8.5h.01M7.5 12h.01M10.5 12h.01M7.5 15.5h.01M10.5 15.5h.01"/><path d="M16 14h.01M16 17h.01"/></Icon>;
const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>;
const IconLoader = (p) => <Icon {...p}><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></Icon>;
const IconSeal = (p) => <Icon {...p}><circle cx="12" cy="9" r="6"/><path d="m8.5 13.5-1.7 7L12 18l5.2 2.5-1.7-7"/></Icon>;
const IconInbox = (p) => <Icon {...p}><path d="M4 12.5 6.5 5h11l2.5 7.5"/><path d="M4 12.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.5"/><path d="M4 12.5h4.5l1 2h5l1-2H20"/></Icon>;

/* =========================================================================
   COMPONENTES DE UI GENÉRICOS
   ========================================================================= */

function StatusBadge({ status, size = 'md' }) {
  const map = {
    CONFORME:     { label: 'Conforme',      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', Icon: IconCheck },
    NAO_CONFORME: { label: 'Não Conforme',  cls: 'bg-rose-50 text-rose-700 ring-rose-600/20',           dot: 'bg-rose-500',    Icon: IconX },
    PENDENTE:     { label: 'Pendente',      cls: 'bg-amber-50 text-amber-700 ring-amber-600/20',        dot: 'bg-amber-500',   Icon: IconClock },
  };
  const s = map[status] || map.PENDENTE;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${s.cls} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      {s.label}
    </span>
  );
}

function Field({ label, children, hint, locked }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 tracking-wide uppercase mb-1.5">
        {label}
        {locked && <IconLock className="w-3 h-3 text-slate-400" />}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// Campo de busca/seleção (combobox): digitar filtra a lista, clicar escolhe,
// e também aceita valor livre (o "lead" pode digitar algo fora da lista).
function Combobox({ value, onChange, options, placeholder, disabled, priorityCodes, inputClassName }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const q = norm(value);
  const filtered = q ? options.filter((o) => o.code.includes(q) || (o.label || '').toUpperCase().includes(q)) : options;
  const priority = priorityCodes ? filtered.filter((o) => priorityCodes.includes(o.code)) : [];
  const rest = priorityCodes ? filtered.filter((o) => !priorityCodes.includes(o.code)) : filtered;
  const groups = {};
  rest.forEach((o) => { const g = o.group || ''; (groups[g] = groups[g] || []).push(o); });

  useEffect(() => {
    function onDocClick(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const baseInputCls = inputClassName || 'w-full rounded-lg border border-slate-200 pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition';

  return (
    <div className="relative" ref={wrapRef}>
      <IconSearch className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        className={baseInputCls}
        autoComplete="off"
      />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1.5 scrollbar-thin anim-fadeIn">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">Nenhum resultado para "{value}".</p>
          )}
          {priority.length > 0 && (
            <div>
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-blue-600">Permitidas nesta zona</p>
              {priority.map((o) => (
                <button key={o.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.code); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{o.code}</span>
                  {o.label && <span className="text-[11px] text-slate-400 truncate">{o.label}</span>}
                </button>
              ))}
              {Object.keys(groups).length > 0 && <div className="my-1 border-t border-slate-100" />}
            </div>
          )}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g || 'x'}>
              {g && <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{g}</p>}
              {items.map((o) => (
                <button key={o.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.code); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{o.code}</span>
                  {o.label && <span className="text-[11px] text-slate-400 truncate">{o.label}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className="fixed top-5 right-5 z-[100] anim-slideDown">
      <div className={`flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 max-w-sm
        ${isError ? 'bg-rose-600 ring-rose-700 text-white' : 'bg-slate-900 ring-slate-800 text-white'}`}>
        {isError ? <IconAlert className="w-5 h-5 mt-0.5 shrink-0" /> : <IconCheck className="w-5 h-5 mt-0.5 shrink-0" />}
        <div className="text-sm leading-snug">{toast.message}</div>
        <button onClick={onClose} className="ml-1 text-white/70 hover:text-white"><IconX className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/* =========================================================================
   TELA DE LOGIN
   ========================================================================= */
function LoginScreen({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!usuario.trim() || !senha.trim()) {
      setError('Informe usuário e senha para continuar.');
      return;
    }
    if (usuario.trim() !== 'admin' || senha !== 'admin123') {
      setError('Usuário ou senha incorretos.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ nome: 'Administrador', usuario: usuario.trim() });
    }, 700);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-700)] text-white flex items-center justify-center shadow-lg shadow-blue-900/20 mb-4">
            <IconSeal className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Compatibilidade Locacional</h1>
          <p className="text-sm text-slate-400 mt-1">Gestão urbana e conformidade de uso</p>
        </div>

        <form onSubmit={submit} className="paper rounded-2xl p-7 anim-slideUp">
          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
              <IconAlert className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="space-y-4">
            <Field label="Usuário">
              <input
                type="text" value={usuario} onChange={(e) => setUsuario(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                placeholder="admin" autoComplete="username" />
            </Field>
            <Field label="Senha">
              <input
                type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                placeholder="••••••••" />
            </Field>
          </div>

          <button type="submit" disabled={loading}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-900)]
                       disabled:opacity-70 text-white text-sm font-semibold py-2.75 py-2.5 transition shadow-sm shadow-blue-900/20">
            {loading ? <IconLoader className="w-4 h-4 anim-spin" /> : null}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="mt-4 text-center">
            <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-slate-400 hover:text-blue-700 transition">Esqueci minha senha</a>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   LAYOUT: SIDEBAR + TOPBAR
   ========================================================================= */
const NAV_ITEMS = [
  { key: 'dashboard',      label: 'Dashboard',      Icon: IconHome },
  { key: 'terrenos',       label: 'Terrenos',       Icon: IconMap },
  { key: 'usuarios',       label: 'Usuários',       Icon: IconUsers },
  { key: 'configuracoes',  label: 'Configurações',  Icon: IconSettings },
];

function Sidebar({ current, onNavigate, onLogout, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden anim-fadeIn" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`fixed lg:static z-40 top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="min-h-[4rem] py-3 flex items-center gap-2.5 px-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-700)] text-white flex items-center justify-center shrink-0">
            <IconSeal className="w-5 h-5" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-[13px] font-bold text-slate-900 leading-snug">Compatibilidade Locacional</p>
            <p className="text-[11px] text-slate-400">Sistema institucional</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setMobileOpen(false)}><IconX className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ key, label, Icon: ItemIcon }) => {
            const active = current === key;
            return (
              <button key={key} onClick={() => { onNavigate(key); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                  ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <ItemIcon className={`w-[18px] h-[18px] ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                {label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition">
            <IconLogout className="w-[18px] h-[18px]" /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, subtitle, onMenu, user, companyName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-20">
      <button className="lg:hidden text-slate-500" onClick={onMenu}><IconMenu className="w-6 h-6" /></button>
      <div className="min-w-0">
        <h1 className="text-base lg:text-lg font-bold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 truncate hidden sm:block">{subtitle}</p>}
      </div>
      <div className="ml-auto relative">
        <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 transition">
          <span className="hidden sm:block text-sm font-medium text-slate-600">{companyName}</span>
          <span className="w-8 h-8 rounded-full bg-[var(--brand-100)] text-[var(--brand-700)] flex items-center justify-center text-xs font-bold ring-1 ring-blue-200">
            {companyName.slice(0, 2).toUpperCase()}
          </span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 py-1.5 anim-slideDown">
            <div className="px-3.5 py-2 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.nome}</p>
              <p className="text-xs text-slate-400 truncate">{user?.usuario}</p>
            </div>
            <button className="w-full text-left px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <IconSettings className="w-4 h-4 text-slate-400" /> Configurações
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* =========================================================================
   DASHBOARD: CARDS
   ========================================================================= */
function StatCard({ label, value, tone, Icon: CardIcon, delay = 0 }) {
  const tones = {
    slate:   'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose:    'bg-rose-50 text-rose-600',
    blue:    'bg-blue-50 text-blue-600',
  };
  return (
    <div className="paper rounded-2xl p-5 anim-slideUp" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <CardIcon className="w-[18px] h-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

/* =========================================================================
   TABELA DE TERRENOS
   ========================================================================= */
const PAGE_SIZE = 5;

function TerrenosTable({ terrenos, onAdd, onView, onDelete }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terrenos;
    return terrenos.filter((t) =>
      t.processoTitulo.toLowerCase().includes(q) ||
      (t.requerente || '').toLowerCase().includes(q) ||
      (t.zona || '').toLowerCase().includes(q) ||
      (t.categoria || '').toLowerCase().includes(q)
    );
  }, [terrenos, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query]);

  return (
    <div className="paper rounded-2xl overflow-hidden anim-slideUp" style={{ animationDelay: '160ms' }}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Terrenos Cadastrados</h2>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <IconSearch className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar empreendimento, zona..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
          </div>
          <button onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-900)] text-white text-sm font-semibold px-3.5 py-2 transition shrink-0 shadow-sm shadow-blue-900/15">
            <IconPlus className="w-4 h-4" /> <span className="hidden sm:inline">Adicionar Terreno</span><span className="sm:hidden">Adicionar</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
            <IconInbox className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">{terrenos.length === 0 ? 'Nenhum terreno cadastrado' : 'Nenhum resultado para essa busca'}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {terrenos.length === 0 ? 'Comece adicionando o primeiro terreno para gerar sua certidão de conformidade.' : 'Tente buscar por outro termo.'}
          </p>
          {terrenos.length === 0 && (
            <button onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-900)] text-white text-sm font-semibold px-4 py-2 transition">
              <IconPlus className="w-4 h-4" /> Adicionar Terreno
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/70">
                  <th className="px-5 py-3">Empresa / Imóvel</th>
                  <th className="px-3 py-3">Requerente</th>
                  <th className="px-3 py-3">Zona</th>
                  <th className="px-3 py-3">Cat. de Uso</th>
                  <th className="px-3 py-3">Largura (m)</th>
                  <th className="px-3 py-3">Pavimentação</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 font-semibold text-slate-800 whitespace-nowrap">{t.processoTitulo}</td>
                    <td className="px-3 py-3.5 text-slate-600 max-w-[160px] truncate" title={t.requerente || ''}>{t.requerente || '—'}</td>
                    <td className="px-3 py-3.5 text-slate-600">{t.zona || '—'}</td>
                    <td className="px-3 py-3.5 text-slate-600">{t.categoria || '—'}</td>
                    <td className="px-3 py-3.5 text-slate-600">{t.largura ? Number(String(t.largura).replace(',', '.')).toFixed(2).replace('.', ',') : '—'}</td>
                    <td className="px-3 py-3.5 text-slate-600">{t.pavimentacao || '—'}</td>
                    <td className="px-3 py-3.5"><StatusBadge status={t.status} size="sm" /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onView(t)} title="Visualizar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition">
                          <IconEye className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === t.id ? (
                          <div className="flex items-center gap-1 anim-fadeIn">
                            <button onClick={() => { onDelete(t.id); setConfirmDeleteId(null); }}
                              className="text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700">Excluir</button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(t.id)} title="Excluir"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                            <IconTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
            <p className="text-xs text-slate-400">Página {pageSafe} de {totalPages}</p>
            <div className="flex items-center gap-1.5">
              <button disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition">
                <IconChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition">
                <IconChevron className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================================
   DOCUMENTO — CERTIDÃO DE CONFORMIDADE (usado na preview e na visualização)
   ========================================================================= */
const ORDEM_GRUPOS = ['R', 'V', 'A', 'S', 'I', 'L', 'E'];

function CertidaoDocument({ data, compact }) {
  const {
    processoTitulo, requerente, zona, categoria, largura, pavimentacao, status, certidaoNumero, processoNumero, criadoEm, motivo,
    lote, quadra, area, endereco, bairro, parcelamento, inscricao, matricula, cri,
  } = data;
  const z = norm(zona);
  const cat = norm(categoria);
  const zonaInfo = ZONA_POR_CODIGO[z];
  const catPermitida = zonaInfo ? (categoriasPermitidasNaZona(z) || []).includes(cat) : false;
  const catReq = CATEGORY_INFO[cat];

  const destacarLista = (lista) => lista.map((c, i) => (
    <span key={c}>
      <span className={c === cat ? 'font-bold underline decoration-2 underline-offset-2' : ''}>{c}</span>
      {i < lista.length - 1 ? ', ' : ''}
    </span>
  ));

  // Categorias permitidas na zona, agrupadas como no Anexo 8.1 (para o item "b")
  const gruposPermitidos = zonaInfo
    ? ORDEM_GRUPOS.map((letra) => ({ letra, label: GRUPOS_CATEGORIA[letra], categorias: zonaInfo.grupos[letra] || [] })).filter((g) => g.categorias.length > 0)
    : [];

  // Agrupa as categorias permitidas na zona por combinação (largura, vias pavimentadas) — item "c"
  const gruposCompat = {};
  (zonaInfo ? Object.values(zonaInfo.grupos).flat() : []).forEach((code) => {
    const req = CATEGORY_INFO[code];
    if (!req) return;
    const key = `${req.largura ?? 'na'}|${req.vias ? 1 : 0}`;
    if (!gruposCompat[key]) gruposCompat[key] = { largura: req.largura, vias: req.vias, categorias: [] };
    gruposCompat[key].categorias.push(code);
  });
  const linhasCompat = Object.values(gruposCompat).sort((a, b) => (a.largura || 0) - (b.largura || 0));

  const dataFmt = new Date(criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const nomeReq = (requerente || '').trim();

  return (
    <div id={compact ? undefined : 'print-area'} className={`font-doc bg-white text-slate-800 ${compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'} w-full`} style={{ minHeight: compact ? 'auto' : '297mm' }}>
      {/* Cabeçalho institucional */}
      <div className="flex items-start gap-4 pb-5 border-b-2 border-slate-800">
        <div className="w-14 h-14 rounded-full bg-[var(--brand-700)] text-white flex items-center justify-center shrink-0">
          <IconSeal className="w-7 h-7" />
        </div>
        <div className="leading-tight">
          <p className="font-sans font-extrabold text-sm tracking-wide">CAMPO GRANDE</p>
          <p className="font-sans font-bold text-xs text-slate-500">PREFEITURA MUNICIPAL</p>
          <p className="font-sans text-[10.5px] text-slate-500 mt-1 max-w-md">
            SECRETARIA MUNICIPAL DE MEIO AMBIENTE, GESTÃO URBANA E DESENVOLVIMENTO ECONÔMICO, TURÍSTICO E SUSTENTÁVEL
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Título */}
      <div className="text-center mt-6 mb-6">
        <h2 className="font-sans font-extrabold text-base sm:text-lg tracking-tight">CERTIDÃO DE CONFORMIDADE</h2>
        <p className="font-sans text-sm text-slate-500 mt-0.5">Nº {certidaoNumero}/SEMADES/SURB/GAU/DAA/{new Date(criadoEm).getFullYear()}</p>
      </div>

      <p className="text-sm mb-4"><span className="font-sans font-semibold text-slate-500">Processo nº</span> {processoNumero}</p>

      {/* Parágrafo legal + requerente */}
      <div className="text-sm leading-relaxed mb-6 text-justify">
        <p className="mb-2"><span className="font-sans font-semibold text-slate-500">Requerente:</span> {nomeReq || '—'}</p>
        <p>
          A Prefeitura Municipal de Campo Grande, ora representada por sua Secretaria de Meio Ambiente, Gestão Urbana e
          Desenvolvimento Econômico, Turístico e Sustentável – SEMADES, tendo como fundamento a Lei Complementar nº 341/2018,
          Anexo 6.1 (Categorias de Uso por Zona e Eixos de Adensamento) e Lei Complementar 74/2005, alterada pela Lei
          Complementar 373/2019, Anexo V (Compatibilidade Locacional), <span className="font-semibold">CERTIFICA QUE:</span>
        </p>
      </div>

      {/* Bloco de conformidade */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:p-5 mb-6">
        {!zonaInfo ? (
          <p className="text-sm italic text-slate-500">A zona "{z || '—'}" não consta no Anexo 8.1 (Lei Complementar nº 341/2018). Situação sujeita à análise técnica.</p>
        ) : !cat ? (
          <p className="text-sm italic text-slate-500">Informe a categoria de uso para gerar o parecer de conformidade.</p>
        ) : (
          <p className="text-sm leading-relaxed text-justify">
            {status === STATUS.CONFORME && (
              <>A categoria de uso <span className="font-bold underline decoration-2 underline-offset-2">{cat}</span> POSSUI USO CONFORME na Zona {zonaInfo.label}, por constar entre as categorias permitidas no Anexo 8.1 (Lei Complementar nº 341/2018) e atender aos requisitos de compatibilidade locacional do Anexo V (Lei Complementar nº 373/2019).</>
            )}
            {status === STATUS.NAO_CONFORME && (
              <>A categoria de uso <span className="font-bold underline decoration-2 underline-offset-2">{cat}</span> NÃO POSSUI USO CONFORME na Zona {zonaInfo.label}. {motivo}</>
            )}
            {status === STATUS.PENDENTE && (
              <>Situação PENDENTE de análise para a categoria de uso <span className="font-bold underline decoration-2 underline-offset-2">{cat}</span>. {motivo}</>
            )}
          </p>
        )}
      </div>

      {/* Elementos referenciais */}
      <div className="mb-6">
        <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Elementos referenciais</p>
        <p className="text-sm text-justify mb-4">
          <span className="font-semibold">a) Descrição do imóvel:</span> Lote {lote || '—'}, Quadra {quadra || '—'}, com área de {area ? `${area}m²` : '—'}, frente
          para a {endereco || '—'}, Bairro {bairro || '—'}, Parcelamento {parcelamento || '—'}, com inscrição imobiliária {inscricao || '—'}, nesta capital,
          matrícula {matricula || '—'}, {cri || '1º'} C.R.I., localizada em: {zonaInfo ? (zonaInfo.label === zonaInfo.code ? `Zona ${zonaInfo.code}` : zonaInfo.label) : (z || '—')}.
        </p>

        <p className="text-sm font-semibold mb-2">b) Categorias de uso permitidas na zona — Anexo 8.1 (Lei Complementar nº 341/2018):</p>

        {gruposPermitidos.length > 0 ? (
          <table className="w-full text-[12px] border border-slate-200 mb-1">
            <thead>
              <tr className="bg-slate-100 font-sans text-[10px] uppercase tracking-wide">
                <th className="px-2.5 py-1.5 text-left font-semibold border-b border-slate-200 w-40">Grupo</th>
                <th className="px-2.5 py-1.5 text-left font-semibold border-b border-slate-200">Categorias permitidas</th>
              </tr>
            </thead>
            <tbody>
              {gruposPermitidos.map((g) => (
                <tr key={g.letra} className="border-t border-slate-100 align-top">
                  <td className="px-2.5 py-1.5 font-semibold text-slate-600">{g.label}</td>
                  <td className={`px-2.5 py-1.5 ${g.categorias.includes(cat) ? 'bg-blue-50/60' : ''}`}>{destacarLista(g.categorias)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm italic text-slate-500">Nenhuma categoria cadastrada para esta zona.</p>
        )}
        {!catPermitida && cat && zonaInfo && (
          <p className="text-[11px] text-rose-600 mt-1">A categoria {cat} não consta na lista acima — não é permitida nesta zona.</p>
        )}

        <p className="text-sm font-semibold mt-4 mb-2">c) Compatibilidade Locacional — Lei Complementar nº 373/2019, Anexo V</p>
        {linhasCompat.length > 0 ? (
          <table className="w-full text-[12.5px] border border-slate-200">
            <thead>
              <tr className="bg-slate-100 font-sans text-[10.5px] uppercase tracking-wide">
                <th className="px-2.5 py-1.5 text-left font-semibold border-b border-slate-200">Categoria</th>
                <th className="px-2.5 py-1.5 text-left font-semibold border-b border-slate-200">Largura da via (em metros)</th>
                <th className="px-2.5 py-1.5 text-left font-semibold border-b border-slate-200">Pavimentação</th>
              </tr>
            </thead>
            <tbody>
              {linhasCompat.map((g, i) => {
                const contem = g.categorias.includes(cat);
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className={`px-2.5 py-1.5 ${contem ? 'font-bold bg-blue-50/60' : ''}`}>{g.categorias.join(', ')}</td>
                    <td className={`px-2.5 py-1.5 ${contem ? 'font-bold bg-blue-50/60' : ''}`}>{g.largura ? `${g.largura}` : 'Não exige'}</td>
                    <td className={`px-2.5 py-1.5 ${contem ? 'font-bold bg-blue-50/60' : ''}`}>{g.vias ? 'Exige' : 'Não exige'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm italic text-slate-500">Sem dados de compatibilidade locacional para as categorias desta zona.</p>
        )}
        {catReq && catReq.nota && (
          <p className="text-[11px] text-slate-500 mt-1.5">({catReq.nota}) {NOTAS_ANEXO_V[catReq.nota]}</p>
        )}
      </div>

      {/* Tabela-resumo do processo */}
      <div>
        <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Resumo do processo</p>
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-800 text-white font-sans text-[11px] uppercase tracking-wide">
              <th className="px-3 py-2 text-left font-semibold">Empreendimento</th>
              <th className="px-3 py-2 text-left font-semibold">Zona</th>
              <th className="px-3 py-2 text-left font-semibold">Cat. de Uso</th>
              <th className="px-3 py-2 text-left font-semibold">Largura (m)</th>
              <th className="px-3 py-2 text-left font-semibold">Pavimentação</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="px-3 py-2.5 font-semibold">{processoTitulo}</td>
              <td className="px-3 py-2.5">{zona || '—'}</td>
              <td className="px-3 py-2.5">{categoria || '—'}</td>
              <td className="px-3 py-2.5">{largura ? Number(String(largura).replace(',', '.')).toFixed(2).replace('.', ',') : '—'}</td>
              <td className="px-3 py-2.5">{pavimentacao || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 pt-4 border-t border-dashed border-slate-300 flex items-center justify-between flex-wrap gap-1">
        <p className="text-[10.5px] text-slate-400 font-sans">Documento gerado eletronicamente pelo sistema Compatibilidade Locacional — protótipo v1.</p>
        <p className="text-[10.5px] text-slate-400 font-sans">Certidão de conformidade {certidaoNumero} · SEI {processoNumero} / pg. 1</p>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: ADICIONAR TERRENO
   ========================================================================= */
function MiniField({ label, value, onChange, placeholder, inputMode, maxLength }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold text-slate-500 tracking-wide uppercase mb-1">{label}</label>
      <input value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
    </div>
  );
}

function AddTerrenoModal({ processIndex, onClose, onSave }) {
  const [zona, setZona] = useState('');
  const [categoria, setCategoria] = useState('');
  const [largura, setLargura] = useState('');
  const [pavimentacao, setPavimentacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const wasUnlocked = useRef(false);

  // Elementos referenciais do imóvel (compõem o item "a)" da certidão)
  const [requerente, setRequerente] = useState('');
  const [lote, setLote] = useState('');
  const [quadra, setQuadra] = useState('');
  const [area, setArea] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [parcelamento, setParcelamento] = useState('');
  const [inscricao, setInscricao] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cri, setCri] = useState('');

  const unlocked = norm(zona).length > 0 && norm(categoria).length > 0;
  const permitidasZona = useMemo(() => categoriasPermitidasNaZona(zona) || [], [zona]);

  useEffect(() => {
    if (unlocked && !wasUnlocked.current) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 550);
      wasUnlocked.current = true;
      return () => clearTimeout(t);
    }
    if (!unlocked) wasUnlocked.current = false;
  }, [unlocked]);

  const requisito = requisitoDaCategoria(categoria);
  const { status, motivo } = useMemo(
    () => calcularConformidade({ zona, categoria, largura, pavimentacao, endereco }),
    [zona, categoria, largura, pavimentacao, endereco]
  );

  const processoTitulo = requerente.trim() || `Novo Terreno ${processIndex}`;
  const previewReady = unlocked;

  const docData = useMemo(() => ({
    processoTitulo, requerente, zona, categoria, largura, pavimentacao, status, motivo,
    lote, quadra, area, endereco, bairro, parcelamento, inscricao, matricula, cri,
    certidaoNumero: 16 + processIndex,
    processoNumero: `${String(74858 + processIndex * 137).slice(-6)}/2025-${String(13 + processIndex * 7).slice(-2)}`,
    criadoEm: new Date().toISOString(),
  }), [zona, categoria, largura, pavimentacao, status, motivo, processoTitulo, requerente, lote, quadra, area, endereco, bairro, parcelamento, inscricao, matricula, cri, processIndex]);

  const handleSave = () => {
    if (!unlocked) return;
    setSaving(true);
    setTimeout(() => {
      onSave({
        id: `t-${Date.now()}`,
        processoTitulo, requerente, zona: norm(zona), categoria: norm(categoria),
        largura: largura || '', pavimentacao: pavimentacao || '',
        lote, quadra, area, endereco, bairro, parcelamento, inscricao, matricula, cri,
        status, motivo,
        certidaoNumero: docData.certidaoNumero, processoNumero: docData.processoNumero,
        criadoEm: docData.criadoEm,
      });
      setSaving(false);
    }, 550);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm anim-fadeIn" onClick={onClose} />
      <div className="relative bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col anim-slideUp overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 sm:px-7 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">{requerente.trim() || 'Novo Terreno'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Processo nº {docData.processoNumero} · Cadastro de terreno e análise de conformidade</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="overflow-y-auto px-5 sm:px-7 py-5 space-y-6 scrollbar-thin">
          <Field label="Nome do requerente / empresa / terreno">
            <input value={requerente} onChange={(e) => setRequerente(e.target.value)} placeholder="Ex.: Valzumiro Ceolim"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Zona" hint="Digite para buscar por nome ou código (Anexo 8.1).">
              <Combobox value={zona} onChange={setZona} options={ZONA_OPTIONS} placeholder="Buscar zona por nome ou código..." />
            </Field>
            <Field label="Cat. de Uso" hint={zona.trim() ? 'Categorias da zona aparecem primeiro.' : 'Digite para buscar por nome ou código.'}>
              <Combobox value={categoria} onChange={setCategoria} options={CATEGORIAS_TODAS} priorityCodes={permitidasZona.length ? permitidasZona : null} placeholder="Buscar categoria por nome ou código..." />
            </Field>

            <Field label="Largura (m)" locked={!unlocked}>
              <div className={`relative rounded-lg ${justUnlocked ? 'anim-unlock' : ''}`}>
                <input value={largura} onChange={(e) => setLargura(e.target.value)} disabled={!unlocked} placeholder={unlocked ? 'Ex.: 15,00' : ''}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                    ${unlocked ? 'border-slate-200 bg-white text-slate-800' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`} />
                {!unlocked && <IconLock className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>
              {requisito && requisito.largura && <p className="mt-1 text-[11px] text-blue-600">Mínimo exigido para {norm(categoria)}: {requisito.largura}m</p>}
            </Field>
            <Field label="Pavimentação" locked={!unlocked}>
              <div className={`relative rounded-lg ${justUnlocked ? 'anim-unlock' : ''}`}>
                <input value={pavimentacao} onChange={(e) => setPavimentacao(e.target.value)} disabled={!unlocked} placeholder={unlocked ? 'Ex.: Não exige' : ''}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                    ${unlocked ? 'border-slate-200 bg-white text-slate-800' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`} />
                {!unlocked && <IconLock className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>
            </Field>
          </div>

          {!unlocked && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3.5 py-2.5 anim-fadeIn">
              <IconLock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Largura e pavimentação ficam bloqueados até informar a Zona e a Categoria de Uso.
            </div>
          )}

          {unlocked && (
            <div className="flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 bg-slate-50 ring-1 ring-slate-200">
              <span className="text-xs font-semibold text-slate-500">Status calculado</span>
              <StatusBadge status={status} size="sm" />
            </div>
          )}

          {/* Elementos referenciais do imóvel — alimentam o item (a) da certidão */}
          <div className="border-t border-dashed border-slate-200 pt-5">
            <h4 className="text-sm font-bold text-slate-800 mb-0.5">Elementos referenciais do imóvel</h4>
            <p className="text-xs text-slate-400 mb-3.5">Opcional, mas necessário para o documento sair idêntico ao modelo oficial (item "a" da certidão).</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MiniField label="Lote" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex.: 10-A1" />
              <MiniField label="Quadra" value={quadra} onChange={(e) => setQuadra(e.target.value)} placeholder="Ex.: 03" />
              <MiniField label="Área (m²)" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: 1.776,2798" />
              <MiniField label="Endereço (frente para)" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Ex.: Rua Alagoas" />
              <MiniField label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Ex.: Jardim dos Estados" />
              <MiniField label="Parcelamento" value={parcelamento} onChange={(e) => setParcelamento(e.target.value)} placeholder="Ex.: São Jorge" />
              <MiniField label="Inscrição imobiliária" value={inscricao} onChange={(e) => setInscricao(maskInscricaoImobiliaria(e.target.value))} placeholder="Ex.: 05.48.004.013-0" inputMode="numeric" maxLength={15} />
              <MiniField label="Matrícula" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex.: 205.236" />
              <MiniField label="C.R.I." value={cri} onChange={(e) => setCri(e.target.value)} placeholder="Ex.: 1º" />
            </div>
          </div>

          <button onClick={handleSave} disabled={!unlocked || saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-900)]
                       disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition shadow-sm shadow-blue-900/20">
            {saving ? <IconLoader className="w-4 h-4 anim-spin" /> : null}
            {saving ? 'Salvando...' : 'SALVAR'}
          </button>

          <div className="border-t border-dashed border-slate-200 pt-5">
            <div className="flex items-center gap-2 mb-1">
              <IconEye className="w-4 h-4 text-slate-400" />
              <h4 className="text-sm font-bold text-slate-800">Preview do documento</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4">Confira como ficará o documento com as informações preenchidas.</p>

            {!previewReady ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-14 px-6 flex flex-col items-center text-center">
                <IconReport className="w-8 h-8 text-slate-300 mb-2.5" />
                <p className="text-sm text-slate-400">Preencha os dados acima para visualizar a prévia do documento.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 anim-fadeIn">
                <div className="max-h-[420px] overflow-y-auto bg-slate-100 p-4 scrollbar-thin">
                  <div className="paper rounded-md mx-auto max-w-xl">
                    <CertidaoDocument data={docData} compact />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: VISUALIZAR DOCUMENTO SALVO
   ========================================================================= */
function ViewDocumentModal({ terreno, onClose }) {
  const docData = {
    processoTitulo: terreno.processoTitulo, requerente: terreno.requerente,
    zona: terreno.zona, categoria: terreno.categoria, largura: terreno.largura, pavimentacao: terreno.pavimentacao,
    lote: terreno.lote, quadra: terreno.quadra, area: terreno.area, endereco: terreno.endereco, bairro: terreno.bairro,
    parcelamento: terreno.parcelamento, inscricao: terreno.inscricao, matricula: terreno.matricula, cri: terreno.cri,
    status: terreno.status, motivo: terreno.motivo,
    certidaoNumero: terreno.certidaoNumero, processoNumero: terreno.processoNumero, criadoEm: terreno.criadoEm,
  };
  const docRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const handleDownloadPdf = () => {
    if (typeof html2pdf === 'undefined') {
      setPdfError('Biblioteca de PDF ainda não carregou (verifique sua conexão) — tente novamente em instantes.');
      return;
    }
    setPdfError('');
    setDownloading(true);
    const nomeArquivo = `certidao-conformidade-${terreno.processoNumero || terreno.certidaoNumero}.pdf`.replace(/\//g, '-');
    html2pdf()
      .set({
        margin: 0,
        filename: nomeArquivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(docRef.current)
      .save()
      .catch(() => setPdfError('Não foi possível gerar o PDF. Tente novamente ou use "Imprimir documento" e salve como PDF pela impressora do navegador.'))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm anim-fadeIn" onClick={onClose} />
      <div className="relative bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col anim-slideUp overflow-hidden">
        <div className="flex items-center gap-3 px-5 sm:px-7 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">{(terreno.requerente || '').trim() || terreno.processoTitulo}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Processo nº {terreno.processoNumero} · Certidão de conformidade nº {terreno.certidaoNumero}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-3 py-2 transition">
              <IconPrinter className="w-4 h-4" /> <span className="hidden sm:inline">Imprimir documento</span>
            </button>
            <button onClick={handleDownloadPdf} disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-900)] disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 transition">
              {downloading ? <IconLoader className="w-4 h-4 anim-spin" /> : <IconDownload className="w-4 h-4" />}
              <span className="hidden sm:inline">{downloading ? 'Gerando PDF...' : 'Baixar PDF'}</span>
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0">
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>
        {pdfError && (
          <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-5 sm:px-7 py-2.5 anim-fadeIn">
            <IconAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {pdfError}
          </div>
        )}
        <div className="overflow-y-auto bg-slate-100 p-4 sm:p-8 scrollbar-thin">
          <div className="paper rounded-md mx-auto max-w-2xl" ref={docRef}>
            <CertidaoDocument data={docData} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   VIEWS: DASHBOARD / TERRENOS / PLACEHOLDERS
   ========================================================================= */
function DashboardView({ terrenos, onAdd, onView, onDelete }) {
  const total = terrenos.length;
  const conformes = terrenos.filter((t) => t.status === STATUS.CONFORME).length;
  const naoConformes = terrenos.filter((t) => t.status === STATUS.NAO_CONFORME).length;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="anim-slideUp">
        <h2 className="text-xl font-extrabold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-400 mt-0.5">Gerencie os terrenos e informações de uso do solo.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Terrenos" value={total} tone="blue" Icon={IconMap} delay={0} />
        <StatCard label="Uso Conforme" value={conformes} tone="emerald" Icon={IconCheck} delay={40} />
        <StatCard label="Uso Não Conforme" value={naoConformes} tone="rose" Icon={IconX} delay={80} />
        <StatCard label="Processos" value={total} tone="slate" Icon={IconReport} delay={120} />
      </div>

      <TerrenosTable terrenos={terrenos} onAdd={onAdd} onView={onView} onDelete={onDelete} />
    </div>
  );
}

function TerrenosView({ terrenos, onAdd, onView, onDelete }) {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="anim-slideUp">
        <h2 className="text-xl font-extrabold text-slate-900">Terrenos</h2>
        <p className="text-sm text-slate-400 mt-0.5">Todos os terrenos e processos cadastrados no sistema.</p>
      </div>
      <TerrenosTable terrenos={terrenos} onAdd={onAdd} onView={onView} onDelete={onDelete} />
    </div>
  );
}

function PlaceholderView({ title, subtitle, Icon: PIcon }) {
  return (
    <div className="p-4 sm:p-8">
      <div className="anim-slideUp mb-6">
        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="paper rounded-2xl py-20 flex flex-col items-center text-center px-6 anim-slideUp">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
          <PIcon className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Em desenvolvimento</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">Esta área está reservada para a próxima versão do sistema.</p>
      </div>
    </div>
  );
}

/* =========================================================================
   SEED DATA (demo inicial)
   ========================================================================= */
function buildSeed() {
  const base = [
    {
      // Réplica dos dados da certidão real de referência (nº 17/SEMADES/SURB/GAU/DAA/2026)
      nomeEmpreendimento: 'Residencial Jardim dos Estados', // nome fictício, apenas para exemplo do protótipo
      zona: 'Z1', categoria: 'R2', largura: '15,00', pavimentacao: 'Não exige',
      requerente: 'Valzumiro Ceolim',
      lote: '10-A1', quadra: '03', area: '1.776,2798', endereco: 'Rua Alagoas', bairro: 'Jardim dos Estados',
      parcelamento: 'São Jorge', inscricao: '05.48.004.013-0', matricula: '205.236', cri: '1º',
      certidaoNumeroFixo: 17, processoNumeroFixo: '074858/2025-77',
    },
    { nomeEmpreendimento: 'Pantanal Corporate Offices', zona: 'Z2', categoria: 'E1', largura: '15,00', pavimentacao: 'Não exige', requerente: 'Construtora Pantanal Ltda.' },
    { nomeEmpreendimento: 'Loteamento Alvorada Sul', zona: 'Z1', categoria: 'E20', largura: '10,00', pavimentacao: 'Exige', requerente: 'Imobiliária Alvorada' },
    { nomeEmpreendimento: 'Comercial Ferreira & Filhos', zona: 'Z3', categoria: 'V2', largura: '', pavimentacao: '', requerente: 'João Batista Ferreira' },
  ];
  const now = Date.now();
  return base.map((b, i) => {
    const idx = i + 1;
    const { status, motivo } = calcularConformidade(b);
    return {
      id: `seed-${idx}`,
      processoTitulo: b.nomeEmpreendimento,
      requerente: b.requerente || '',
      zona: b.zona, categoria: b.categoria, largura: b.largura, pavimentacao: b.pavimentacao,
      lote: b.lote || '', quadra: b.quadra || '', area: b.area || '', endereco: b.endereco || '', bairro: b.bairro || '',
      parcelamento: b.parcelamento || '', inscricao: b.inscricao || '', matricula: b.matricula || '', cri: b.cri || '',
      status, motivo,
      certidaoNumero: b.certidaoNumeroFixo || (16 + idx),
      processoNumero: b.processoNumeroFixo || `${String(74858 + idx * 137).slice(-6)}/2025-${String(13 + idx * 7).slice(-2)}`,
      criadoEm: new Date(now - (4 - idx) * 86400000).toISOString(),
    };
  });
}

/* =========================================================================
   APP
   ========================================================================= */
function App() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [terrenos, setTerrenos] = useState(buildSeed());
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingTerreno, setViewingTerreno] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const companyName = 'Empresa Exemplo';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const handleLogin = (u) => { setUser(u); setAuthed(true); };
  const handleLogout = () => { setAuthed(false); setUser(null); setView('dashboard'); };

  const handleSaveTerreno = (novo) => {
    setTerrenos((prev) => [novo, ...prev]);
    setShowAddModal(false);
    const msg = novo.status === STATUS.CONFORME
      ? `${novo.processoTitulo} salvo com sucesso — Uso Conforme.`
      : novo.status === STATUS.NAO_CONFORME
        ? `${novo.processoTitulo} salvo — Uso Não Conforme.`
        : `${novo.processoTitulo} salvo — status Pendente de análise.`;
    showToast(msg, novo.status === STATUS.NAO_CONFORME ? 'error' : 'success');
  };

  const handleDelete = (id) => {
    setTerrenos((prev) => prev.filter((t) => t.id !== id));
    showToast('Terreno removido.', 'success');
  };

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  const titles = {
    dashboard: ['Dashboard', 'Gerencie os terrenos e informações de uso do solo.'],
    terrenos: ['Terrenos', 'Todos os terrenos cadastrados.'],
    usuarios: ['Usuários', 'Gestão de acessos e permissões.'],
    configuracoes: ['Configurações', 'Preferências do sistema.'],
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar current={view} onNavigate={setView} onLogout={handleLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={titles[view][0]} subtitle={titles[view][1]} onMenu={() => setMobileOpen(true)} user={user} companyName={companyName} />
        <main className="flex-1 min-w-0">
          {view === 'dashboard' && <DashboardView terrenos={terrenos} onAdd={() => setShowAddModal(true)} onView={setViewingTerreno} onDelete={handleDelete} />}
          {view === 'terrenos' && <TerrenosView terrenos={terrenos} onAdd={() => setShowAddModal(true)} onView={setViewingTerreno} onDelete={handleDelete} />}
          {view === 'usuarios' && <PlaceholderView title="Usuários" subtitle="Gestão de acessos e permissões." Icon={IconUsers} />}
          {view === 'configuracoes' && <PlaceholderView title="Configurações" subtitle="Preferências do sistema." Icon={IconSettings} />}
        </main>
      </div>

      {showAddModal && (
        <AddTerrenoModal processIndex={terrenos.length + 1} onClose={() => setShowAddModal(false)} onSave={handleSaveTerreno} />
      )}
      {viewingTerreno && <ViewDocumentModal terreno={viewingTerreno} onClose={() => setViewingTerreno(null)} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
