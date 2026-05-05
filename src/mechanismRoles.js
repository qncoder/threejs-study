export const MECHANISM_ROLES = [
  {
    key: 'Base',
    label: '底座',
    type: '固定基座',
    confidence: '高',
    description: '承载整套支架，是其他运动件的参考基础。',
    controlHint: '后续通常不直接调它，除非需要整体移动模型。',
  },
  {
    key: 'FrontColumn',
    label: '前立柱油缸组',
    type: '主驱动',
    confidence: '高',
    description: '主要负责升降顶梁，是当前模型里最明显的竖向液压驱动。',
    controlHint: '后续可以优先用它的伸缩量驱动顶梁高度。',
  },
  {
    key: 'Rod',
    label: '连杆组',
    type: '传动件',
    confidence: '中',
    description: '连接底座、顶梁和掩护梁，把油缸运动传给上部结构。',
    controlHint: '一般跟随主驱动计算，不建议单独手动改位置。',
  },
  {
    key: 'TopBeam',
    label: '顶梁',
    type: '主要从动件',
    confidence: '高',
    description: '受前立柱和连杆组影响，是上部主要承载部件。',
    controlHint: '后续应由前立柱和连杆关系带动。',
  },
  {
    key: 'Shield',
    label: '掩护梁',
    type: '主要从动件',
    confidence: '高',
    description: '位于顶梁和尾梁之间，受连杆和中间斜油缸影响。',
    controlHint: '可以作为中间斜油缸的主要被带动对象。',
  },
  {
    key: 'TailBeam',
    label: '尾梁',
    type: '主要从动件',
    confidence: '高',
    description: '位于后部，和掩护梁、后部小油缸存在联动关系。',
    controlHint: '后续应由掩护梁和后部小油缸共同约束。',
  },
  {
    key: 'FlexBeamStroke',
    label: '伸缩梁油缸',
    type: '辅助驱动',
    confidence: '高',
    description: '中间斜向小油缸，主要拉动斜着的板件。',
    controlHint: '可单独做一个伸缩控制，目标先绑定掩护梁相关部件。',
  },
  {
    key: 'BackStroke',
    label: '后部油缸',
    type: '辅助驱动',
    confidence: '中',
    description: '位于后部，可能控制尾梁或后部板件姿态。',
    controlHint: '需要结合实际运动观察确认它具体带动哪个后部组件。',
  },
  {
    key: 'FrontStroke',
    label: '前部推移油缸',
    type: '辅助驱动',
    confidence: '中',
    description: '命名显示它是前部推移相关油缸。',
    controlHint: '后续可以作为前部局部动作控制项。',
  },
  {
    key: 'PlatteStroke',
    label: '护帮板油缸',
    type: '辅助驱动',
    confidence: '中',
    description: '命名显示它和护帮板动作有关。',
    controlHint: '需要在模型里选中相关板件后再确认控制对象。',
  },
  {
    key: 'Flap1',
    label: '翻板机构',
    type: '局部机构',
    confidence: '高',
    description: '包含翻板本体、驱动轴、输出轴和油缸。',
    controlHint: '适合后续单独做翻板角度控制。',
  },
  {
    key: 'BaseSidePush',
    label: '底座侧推油缸',
    type: '局部机构',
    confidence: '高',
    description: '底座两侧的侧推油缸组。',
    controlHint: '适合做左右侧推的局部控制。',
  },
  {
    key: 'BaseLifting',
    label: '底座抬底油缸',
    type: '局部机构',
    confidence: '中',
    description: '命名显示它和底座抬升动作有关。',
    controlHint: '后续可作为底座局部抬升动作控制项。',
  },
  {
    key: 'Blance',
    label: '平衡油缸',
    type: '局部机构',
    confidence: '中',
    description: '命名可能表示平衡油缸，保留原始拼写 Blance。',
    controlHint: '需要后续通过动作验证它的受力和带动对象。',
  },
];

export const CONNECTION_DRAFT = [
  { from: 'Base', to: 'FrontColumn', relation: '安装基础' },
  { from: 'Base', to: 'Rod', relation: '连杆下端约束' },
  { from: 'FrontColumn', to: 'TopBeam', relation: '升降驱动' },
  { from: 'Rod', to: 'TopBeam', relation: '连杆传动' },
  { from: 'Rod', to: 'Shield', relation: '连杆传动' },
  { from: 'Shield', to: 'TailBeam', relation: '后部铰接联动' },
  { from: 'FlexBeamStroke', to: 'Shield', relation: '斜油缸拉动' },
  { from: 'BackStroke', to: 'TailBeam', relation: '后部油缸控制' },
  { from: 'Flap1', to: 'PlatteStroke', relation: '翻板局部驱动' },
  { from: 'BaseSidePush', to: 'Base', relation: '底座侧推' },
  { from: 'BaseLifting', to: 'Base', relation: '底座抬升' },
  { from: 'Blance', to: 'TopBeam', relation: '平衡约束' },
];

const roleByKey = new Map(MECHANISM_ROLES.map((role) => [role.key.toLowerCase(), role]));

export function findMechanismRole(row) {
  const candidates = [row?.name, ...(String(row?.path ?? '').split('/'))]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  for (const name of candidates) {
    if (roleByKey.has(name)) return roleByKey.get(name);
  }

  return null;
}

export function enrichNodeRowsWithRoles(rows) {
  return rows.map((row) => ({
    ...row,
    mechanismRole: findMechanismRole(row),
  }));
}

export function getConnectionsForPart(partKey) {
  return CONNECTION_DRAFT.filter((connection) => connection.from === partKey || connection.to === partKey);
}
