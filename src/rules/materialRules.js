const GRUPO_MATERIAL_CALCADO = 'Calçado';
const GRUPO_MATERIAL_VESTIMENTA = 'Vestimenta';
const GRUPO_MATERIAL_PROTECAO_MAOS = 'Proteção das Mãos';

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

const requiresTamanho = (grupo) =>
  isGrupo(grupo, GRUPO_MATERIAL_VESTIMENTA) || isGrupo(grupo, GRUPO_MATERIAL_PROTECAO_MAOS);

const normalizeCaracteristicaLista = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
      .filter(Boolean);
  }
  const texto = String(value ?? '');
  if (!texto.trim()) {
    return [];
  }
  return texto
    .split(/[;|,]/)
    .map((parte) => String(parte).trim())
    .filter(Boolean);
};

const formatCaracteristicaTexto = (value) =>
  Array.from(new Set(normalizeCaracteristicaLista(value)))
    .sort((a, b) => a.localeCompare(b))
    .join('; ');

const buildNumeroEspecifico = ({ grupoMaterial, numeroCalcado, numeroVestimenta }) => {
  if (isGrupo(grupoMaterial, GRUPO_MATERIAL_CALCADO)) {
    return sanitizeDigits(numeroCalcado);
  }
  if (requiresTamanho(grupoMaterial)) {
    return String(numeroVestimenta || '').trim();
  }
  return '';
};

const buildChaveUnica = ({
  grupoMaterial,
  nome,
  fabricante,
  numeroCalcado,
  numeroVestimenta,
  caracteristicaEpi,
  corMaterial,
  ca,
}) => {
  const partes = [
    normalizeKeyPart(nome),
    normalizeKeyPart(fabricante),
    normalizeKeyPart(grupoMaterial),
  ];
  const numero = normalizeKeyPart(numeroCalcado || numeroVestimenta);
  if (numero) {
    partes.push(numero);
  }
  const caracteristicas = normalizeCaracteristicaLista(caracteristicaEpi);
  if (caracteristicas.length) {
    partes.push(
      caracteristicas
        .map((item) => normalizeKeyPart(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join('||'),
    );
  }
  const cor = normalizeKeyPart(corMaterial);
  if (cor) {
    partes.push(cor);
  }
  const caNormalizado = normalizeKeyPart(sanitizeDigits(ca));
  if (caNormalizado) {
    partes.push(caNormalizado);
  }
  return partes.join('||');
};

function validarDadosObrigatorios({
  nome,
  fabricante,
  validadeDias,
  valorUnitario,
  grupoMaterial,
  numeroCalcado,
  numeroVestimenta,
  caracteristicaEpi,
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
  if (requiresTamanho(grupoMaterial) && !String(numeroVestimenta || '').trim()) {
    throw new Error('Informe o tamanho');
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
  if (!normalizeCaracteristicaLista(caracteristicaEpi).length) {
    throw new Error('Informe ao menos uma caracteristica');
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
  GRUPO_MATERIAL_PROTECAO_MAOS,
  validarDadosObrigatorios,
  validarEstoqueMinimo,
  sanitizeNomeEpi,
  buildNumeroEspecifico,
  buildChaveUnica,
  sanitizeDigits,
  isGrupoCalcado: (valor) => isGrupo(valor, GRUPO_MATERIAL_CALCADO),
  isGrupoVestimenta: (valor) => isGrupo(valor, GRUPO_MATERIAL_VESTIMENTA),
  formatCaracteristicaTexto,
  requiresTamanho,
};
