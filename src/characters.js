// NPC database: appearance, personality, dialogue, building function.
// Russian flavor text per the DESIGN.md lore.

export const CHARACTERS = {
  theo: {
    id: 'theo',
    name: 'Тео',
    title: 'Лаборатория и Портал',
    tier: 1,
    color: 0x33cc66,
    accent: 0xffd700,
    look: 'Зелёные волосы, живые зелёные глаза, белый халат поверх синей рубашки с золотыми пуговицами, чёрные брюки, начищенные туфли.',
    personality: 'Увлечённый учёный-биоинженер, обожает работать с живыми организмами и мутациями. Коренной житель, презирает скуку.',
    line: (g) => g.wave >= 1 ? 'О, вылагай, что выпало! Только не говори, что опять одни дубликаты базовой «Исцеления»…' : 'Приветствую в Атлантиде. Да, я переименовал этот мир — «Земля» было верхом уныния.',
    greet: 'Лаборатория Тео. Здесь расшифровываются кейсы из подземелий. 4 слота, открываю по одному.',
  },
  carrion: {
    id: 'carrion',
    name: 'Кэррион',
    title: 'Мэрия',
    tier: 2,
    color: 0xffcc33,
    accent: 0xff2233,
    look: 'Высокий статный эльф с волосами солнечного цвета и пронзительными красными глазами. Одет безупречно.',
    personality: 'Манерный, обаятельный, слегка самовлюблённый. Сыпет любовными шуточками, любит донимать Эрри.',
    line: () => 'Добро пожаловать в Мэрия, о прекрасный странник. В делах управления я не знаю равных — и в любви, если хочется честно.',
    greet: 'Менеджмент острова, статистика поселения и межсерверный Рейтинг — всё здесь.',
  },
  yarilyk: {
    id: 'yarilyk',
    name: 'Ярик',
    title: 'Шатер «Клоунада»',
    tier: 3,
    color: 0xff66cc,
    accent: 0xffffff,
    look: 'Существо с маленькими крылышками за спиной, в пестром клоунском костюме.',
    personality: 'Энергичный балагур, главный сплетник Атлантиды, автор шипперских фанфиков.',
    line: () => 'Ой, ой! Слушайте сюда, а ведь Кэррион и Борн… ну вы сами додумаете. А пока — ачивки! За них дают Глаза стража.',
    greet: 'Шатер «Клоунада». Я —系统 achievements. Развлекаю и награждаю.',
  },
  grisha: {
    id: 'grisha',
    name: 'Гриша',
    title: 'Секретный подвал',
    tier: 3,
    color: 0x3366ff,
    accent: 0x000000,
    look: 'Костюм человечка из «Монополии»: фрак, цилиндр, бабочка, трость. Один глаз абсолютно чёрный, второй — чисто белый.',
    personality: 'Харизматичный подпольный шоумен и крупье с неиссякаемым запасом чёрного юмора.',
    line: () => 'Тсс. Никому ни слова. Ставка — Глаза стража. Шансы честные: 37%. Колесо не лжёт.',
    greet: 'Подвал под Клоунадой. Рулетка. Только тихо.',
  },
  tramplin: {
    id: 'tramplin',
    name: 'Трамплин',
    title: 'Магическая библиотека',
    tier: 3,
    color: 0xff8833,
    accent: 0xffffff,
    look: 'Эльф с белыми волосами, глаза скрыты под плотной оранжевой повязкой.',
    personality: 'Спокойный, невозмутимый, рассудительный. Читает магию и код кончиками пальцев.',
    line: () => 'Тише. Карты наradomно. Дубликаты объединяю, уровень повышаю. До 10-го — печать, и выпадать перестанет.',
    greet: 'Библиотека. Зачарование карт и объединение дубликатов.',
  },
  kemet: {
    id: 'kemet',
    name: 'Кемет и Ви',
    title: 'Реактор',
    tier: 4,
    color: 0x9933ff,
    accent: 0xffffff,
    look: 'Кемет — чёрное тело, белые глаза и широкая белая улыбка, щупальца. Ви — статная женщина, белые волосы, чёрное платье.',
    personality: 'Ви — материнское тёплое отношение к Кемет. Кемет обожает «маму Ви». Обе любят писать истории.',
    line: () => 'О, вы пришли! Кемет готова порвать любого за маму Ви, но сегодня она в хорошем настроении. Реактор качается — баффы поселения растут.',
    greet: 'Реактор. Открытие запускает электросеть: факелы → лампы. Пассивные баффы: добыча Призмарина, шанс редкой валюты, скорость кейсов.',
  },
  lauf: {
    id: 'lauf',
    name: 'Лауф',
    title: 'Домик на окраине',
    tier: 5,
    color: 0x66aaff,
    accent: 0xffffff,
    look: 'Блондинистые волосы, голубые глаза, домашняя клетчатая рубашка.',
    personality: 'Кодер-интроверт. Отвечает лениво, коротко. Оживает только глубокой ночью.',
    line: () => 'мм. обмен. только равноценный. одна карта за 24 часа с каждого. нельзя просто подарить. ясно? …да.',
    greet: 'Терминал Лауфа. Обмен картами между игроками. Правила железные.',
  },
  erri: {
    id: 'erri',
    name: 'Эрри',
    title: 'Торговая лавка',
    tier: 2,
    color: 0xcc2244,
    accent: 0xffffff,
    look: 'Темнокожая цыганка, чёрно-красные волосы, роскошное красное платье.',
    personality: 'Предельно серьёзная, строгая, говорит исключительно по делу. На дух не переносит флирт.',
    line: () => 'По делу? Лавка. Призмарин — в обмен на карты и улучшения. Никаких mềmких слов.',
    greet: 'Торговая лавка Эрри. Карты, улучшения, снадобья — всё за Призмарин.',
  },
  born: {
    id: 'born',
    name: 'Борн',
    title: 'Вольер с собаками',
    tier: 2,
    color: 0x8a6644,
    accent: 0xddccaa,
    look: 'Массивный гуманоидный фурри-волк со шрамами и оружием наперевес.',
    personality: 'Суровый ветеран, 2000 лет. Бывший наёмник. Говорит об охоте, тактике, оружии.',
    line: () => 'Охота. Тактика. Оружие. Молчать, пока не спросят. А Ряжа… ах, простите. Пасивный доход — от собак.',
    greet: 'Вольер Борна. Собаки приносят пассивный доход и защищают остров.',
  },
  phantom: {
    id: 'phantom',
    name: 'Человек-Фантом',
    title: 'Водяная мельница',
    tier: 3,
    color: 0x33aaff,
    accent: 0x66ff66,
    look: 'Голубая кожа, чёрные волосы, зелёные глаза, острые зубы, маленькие крылышки.',
    personality: 'Пугливый и слегка феминный. Случайно можно застать в платье — тогда скрывается с визгом.',
    line: () => 'Ой! Я? В платье? Вам показалось. Водяная мельница приносит пассивный доход. Просто вода и колеса.',
    greet: 'Мельница Фантома. Водяные колеса — пассивный доход поселения.',
  },
  ryazha: {
    id: 'ryazha',
    name: 'Ряжа',
    title: 'Гильдия охотников',
    tier: 3,
    color: 0xff4488,
    accent: 0xffaa22,
    look: 'Девушка-андроид, розовые волосы, белая толстовка, оранжевый шарф, огромный боевой топор.',
    personality: 'Путешественница, глава гильдии, отбойный чёрный юмор. Подкалыва Борна.',
    line: () => 'Охотники гильдии — за Резонанс и Призмарин. А Борну я, конечно, не скажу, что он стареет.',
    greet: 'Гильдия охотников Ряжи. Охотничьи contracts — источник Призмарина.',
  },
  kompik: {
    id: 'kompik',
    name: 'Компик',
    title: 'Домик-оружейная',
    tier: 3,
    color: 0x44dd44,
    accent: 0x22ff22,
    look: 'Катодец: спортивное тело, вместо головы — пузатый кинескопный монитор с зелёным пиксельным лицом.',
    personality: 'Взрывной, боевой, невероятно энергичный. Яростно тренируется на манекене.',
    line: () => 'ТРЕНИРОВКА! Оружие ближнего боя — моя страсть. Призмарин за арсенал, детали, улучшения!',
    greet: 'Домик Компика. Арсенал и улучшения оружия за Призмарин.',
  },
  scaler: {
    id: 'scaler',
    name: 'Скаллер',
    title: 'Пещера',
    tier: 4,
    color: 0x2299aa,
    accent: 0x88ffcc,
    look: 'Слепое гуманоидное существо из тёмно-бирюзового скалка.',
    personality: 'Мягок и меланхоличен. Был благородным рыцарем до Роя. Мечтает о человеческой семье.',
    line: () => 'Я не помню, как отсоединился от Роя… но помню, что был рыцарем. Пещера приносит пассивный доход.',
    greet: 'Пещера Скаллера. Скалка и уют — пассивный доход.',
  },
  fraegid: {
    id: 'fraegid',
    name: 'Фрейгид',
    title: 'Склеп',
    tier: 4,
    color: 0xdddddd,
    accent: 0xaaffaa,
    look: 'Огромный, широкоплечий накачанный скелет. Иногда надевает очки для чтения.',
    personality: 'Спокойный, душевный, тёплый. Превратил склеп в уютный читальный зал.',
    line: () => 'О, гость! Как литература? Трамплин — моя душа. Склеп даёт пассивный доход и тёплую атмосферу.',
    greet: 'Склеп Фрейгида. Читальный зал и пассивный доход.',
  },
  misha: {
    id: 'misha',
    name: 'Миша и Семен',
    title: 'Розовый дом уток',
    tier: 4,
    color: 0xff88aa,
    accent: 0xffdd66,
    look: 'Антропоморфные утки. Миша — жёлтая шерстка, технарская экипировка. Семен — белая шерстка.',
    personality: 'Миша — спокойный изобретатель. Семен — наглый любитель лёгких денег.',
    line: () => 'Квак! Миша ремонтирует, Семен мечтает о бизнесе и лебедях-горничных. Пассивный доход от пляжа.',
    greet: 'Розовый дом уток. Пляжный пассивный доход и изобретения.',
  },
};

// helpers
export function getChar(id) { return CHARACTERS[id]; }

// Character avatar builder — stylized procedural avatar matching description.
export function buildAvatar(scene, def, opts = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6, metalness: 0.2, emissive: def.color, emissiveIntensity: 0.15 });
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.5, metalness: 0.3, emissive: def.accent, emissiveIntensity: 0.2 });

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 8), bodyMat);
  torso.position.y = 1.0;
  group.add(torso);
  // legs
  for (const dx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), bodyMat);
    leg.position.set(dx, 0.35, 0);
    group.add(leg);
  }
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), accentMat);
  head.position.y = 1.75;
  group.add(head);
  // hat / feature per character
  if (def.id === 'grisha' || def.id === 'yarilyk') {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 8), accentMat);
    hat.position.y = 2.15;
    group.add(hat);
  }
  if (def.id === 'fraegid') {
    // skeleton: add ribcage lines
    for (let i = 0; i < 3; i++) {
      const ribs = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 10), bodyMat);
      ribs.position.y = 1.0 + i * 0.12;
      ribs.rotation.x = Math.PI / 2;
      group.add(ribs);
    }
  }
  if (def.id === 'kemet') {
    // tentacles
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 6), bodyMat);
      t.position.set(Math.cos(i * 2) * 0.3, 0.6, Math.sin(i * 2) * 0.3);
      t.rotation.z = Math.cos(i) * 0.4;
      group.add(t);
    }
  }
  if (def.id === 'tramplin') {
    // blindfold
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.05), new THREE.MeshStandardMaterial({ color: def.accent }));
    band.position.y = 1.8;
    group.add(band);
  }
  if (def.id === 'kompik') {
    // monitor head
    head.geometry.dispose();
    head.geometry = new THREE.BoxGeometry(0.5, 0.4, 0.3);
    head.scale.set(1, 1, 1);
  }
  if (def.id === 'phantom') {
    // wings
    for (const dx of [-0.3, 0.3]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 5), accentMat);
      wing.position.set(dx, 1.4, -0.1);
      wing.rotation.z = dx > 0 ? -0.5 : 0.5;
      group.add(wing);
    }
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  if (opts.pos) group.position.copy(opts.pos);
  if (opts.scale) group.scale.setScalar(opts.scale);
  scene.add(group);
  return group;
}
