const GRUPO_MATERIAL_CALCADO = 'Calçado';
const GRUPO_MATERIAL_VESTIMENTA = 'Vestimenta';

const normalizeKeyPart = (value) =>
  value
    ? String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : '';

const isGrupo = (value, target) => normalizeKeyPart(value) === normalizeKeyPart(target);

const sanitizeDigits = (value = '') => String(value).replace(/\D/g, '');

const sanitizeNomeEpi = (value = '') => String(value).replace(/\d/g, '').trim();

const buildNumeroEspecifico = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO)) {
    return sanitizeDigits(numeroCalcado);
  }
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_VESTIMENTA)) {
    return String(numeroVestimenta || '').trim();
  }
  return '';
};

const buildChaveUnica = ({ grupoMaterial, nome, fabricante, numeroEspecifico }) =>
  [
    normalizeKeyPart(grupoMaterial),
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(numeroEspecifico),
  ].join('||');

function validarDadosObrigatorios({
  nome,
  fabricante,
  validadeDias,
  valorUnitario,
  ca,
  grupoMaterial,
  numeroCalcado,
  numeroVestimenta,
}) {
  const nomeSanitizado = sanitizeNomeEpi(nome);
  if (!nomeSanitizado) {
    throw new Error('Nome do EPI obrigatorio e nao pode conter numeros');
  }
  if (/\d/.test(String(nome || ''))) {
    throw new Error('O campo EPI nao pode conter numeros');
  }
  if (!grupoMaterial || !String(grupoMaterial).trim()) {
    throw new Error('Grupo de material obrigatorio');
  }
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO) && !sanitizeDigits(numeroCalcado)) {
    throw new Error('Informe o numero do calcado');
  }
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_VESTIMENTA) && !String(numeroVestimenta || '').trim()) {
    throw new Error('Informe o numero da vestimenta');
  }
  if (!fabricante || !String(fabricante).trim()) {
    throw new Error('Fabricante obrigatorio');
  }
  if (Number.isNaN(Number(validadeDias)) || Number(validadeDias) <= 0) {
    throw new Error('Validade deve ser maior que zero');
  }
  if (Number.isNaN(Number(valorUnitario)) || Number(valorUnitario) <= 0) {
    throw new Error('Valor unitario deve ser maior que zero');
  }
  if (!sanitizeDigits(ca)) {
    throw new Error('CA obrigatorio');
  }
}

function validarEstoqueMinimo(estoqueMinimo) {
  if (estoqueMinimo === undefined || estoqueMinimo === null) {
    return;
  }
  if (Number.isNaN(Number(estoqueMinimo)) || Number(estoqueMinimo) < 0) {
    throw new Error('Estoque minimo deve ser zero ou positivo');
  }
}

module.exports = {
  GRUPO_MATERIAL_CALCADO,
  GRUPO_MATERIAL_VESTIMENTA,
  validarDadosObrigatorios,
  validarEstoqueMinimo,
  sanitizeNomeEpi,
  buildNumeroEspecifico,
  buildChaveUnica,
  sanitizeDigits,
  isGrupoCalcado: (valor) => isGrupo(valor, GRUPO_MATERIAL_CALCADO),
  isGrupoVestimenta: (valor) => isGrupo(valor, GRUPO_MATERIAL_VESTIMENTA),
};
