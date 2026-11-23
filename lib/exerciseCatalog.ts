// 검증된 운동 목록과 한국어 대응표 (확장 STEP 4~6)
// ExerciseDB 검색 결과를 그대로 쓰지 않고, 사람이 이름·부위·기구·동작을 확인한 운동만 여기에 올린다.
// 맞는 GIF가 없으면 다른 운동 GIF로 대신하지 않고 exerciseDbId를 null로 둔다(화면에는 GIF 없이 보인다).

import { DEFAULTS, type Exercise, type Routine } from "./routines";

/** 큰 구분: 운동 찾기의 첫 번째 칩 */
export type Region = "상체" | "하체";
/** 세부 부위: 큰 구분을 고르면 나오는 두 번째 칩이자 운동 카드의 태그 */
export type BodyPart = "등" | "가슴" | "어깨" | "팔" | "허벅지" | "엉덩이" | "종아리";
export type Equipment = "머신" | "케이블" | "바벨" | "덤벨" | "맨몸";

/** 큰 구분별 세부 부위 */
export const REGION_PARTS: Record<Region, readonly BodyPart[]> = {
  상체: ["등", "가슴", "어깨", "팔"],
  하체: ["허벅지", "엉덩이", "종아리"],
};

export type CatalogExercise = {
  /** 앱 안의 운동 ID. 샘플 루틴의 운동 ID와 같다 */
  key: string;
  /** 화면에 보이는 한국어 이름 */
  name: string;
  bodyPart: BodyPart;
  equipment: Equipment;
  /** 검색에 쓰는 다른 이름(소문자·공백 없이 비교한다) */
  aliases: string[];
  /** ExerciseDB 운동 ID. 맞는 GIF를 찾지 못했으면 null */
  exerciseDbId: string | null;
  /** 이 대응이 맞다고 확인한 근거(개발 기록용) */
  checked: string;
};

export const REGIONS: readonly Region[] = ["상체", "하체"];
export const EQUIPMENTS: readonly Equipment[] = ["머신", "케이블", "바벨", "덤벨", "맨몸"];

/** 기존 샘플 운동 7개. 이름·부위·기구는 직접 정했고, GIF는 이름·기구·부위·동작 화면을 보고 골랐다. */
const BASE_CATALOG: readonly CatalogExercise[] = [
  {
    key: "lat-pulldown",
    name: "랫풀다운",
    bodyPart: "등",
    equipment: "케이블",
    aliases: ["렛풀다운", "랫풀", "latpulldown", "풀다운"],
    exerciseDbId: "eYnzaCm", // cable bar lateral pulldown (cable · back · latissimus dorsi)
    checked: "이름·부위·기구 일치, 바를 위에서 당기는 동작 확인",
  },
  {
    key: "chest-press",
    name: "체스트프레스",
    bodyPart: "가슴",
    equipment: "머신",
    aliases: ["체스트 프레스", "머신체스트프레스", "chestpress"],
    exerciseDbId: "DOoWcnA", // Machine Chest Press (leverage machine · chest · pectorals)
    checked: "이름·부위·기구 일치, 머신 앉아서 미는 동작 확인",
  },
  {
    key: "shoulder-press",
    name: "숄더프레스",
    bodyPart: "어깨",
    equipment: "머신",
    aliases: ["숄더 프레스", "머신숄더프레스", "어깨프레스", "shoulderpress"],
    // 같은 이름의 67n3r98은 화면이 플레이트를 드는 다른 동작이라 쓰지 않는다
    exerciseDbId: "dNFYIU1", // Machine Shoulder Press (leverage machine · shoulders · deltoids)
    checked: "같은 이름 2개 중 동작이 맞는 것만 선택",
  },
  {
    key: "leg-press",
    name: "레그프레스",
    bodyPart: "허벅지",
    equipment: "머신",
    aliases: ["레그 프레스", "legpress"],
    exerciseDbId: "2Qh2J1e", // Sled 45° Leg Press (sled machine · upper legs)
    checked: "이름·부위 일치, 45도 레그프레스 머신 동작 확인",
  },
  {
    key: "hip-abduction",
    name: "아웃타이",
    bodyPart: "엉덩이",
    equipment: "머신",
    aliases: ["힙어브덕션", "힙 어브덕션", "바깥쪽허벅지", "hipabduction", "아웃싸이"],
    exerciseDbId: "CHpahtl", // Machine Seated Hip Abduction (leverage machine · abductors)
    checked: "이름·부위·기구 일치, 다리를 벌리는 동작 확인",
  },
  {
    key: "hip-adduction",
    name: "인타이",
    bodyPart: "허벅지",
    equipment: "머신",
    aliases: ["힙어덕션", "힙 어덕션", "안쪽허벅지", "hipadduction", "인싸이"],
    exerciseDbId: "oHsrypV", // Machine Seated Hip Adduction (leverage machine · adductors)
    checked: "이름·부위·기구 일치, 다리를 모으는 동작 확인",
  },
  {
    key: "squat",
    name: "스쿼트",
    bodyPart: "허벅지",
    equipment: "바벨",
    aliases: ["바벨스쿼트", "바벨 스쿼트", "squat"],
    exerciseDbId: "qXTaZnJ", // barbell full squat (barbell · upper legs)
    checked: "이름·부위·기구 일치, 바벨을 메고 앉았다 일어나는 동작 확인",
  },
];

/** 확장 운동의 근거 문구(모두 화면에서 동작을 확인하고 GIF 파일이 실제로 열리는 것만 올렸다) */
const SEEN = "이름·부위·기구 일치, GIF 동작 확인";

function item(
  key: string,
  name: string,
  bodyPart: BodyPart,
  equipment: Equipment,
  exerciseDbId: string,
  aliases: string[] = [],
): CatalogExercise {
  return { key, name, bodyPart, equipment, aliases, exerciseDbId, checked: SEEN };
}

/**
 * 확장 운동. 같은 이름의 후보가 여러 개이거나 GIF가 열리지 않는 항목(예: 케이블 시티드 로우 A3P4O0R,
 * 어시스티드 풀업 5ipN0iE, 루마니안 데드리프트 o6LqKKP)은 동작이 맞고 GIF가 열리는 다른 항목을 골랐다.
 */
const EXTRA_CATALOG: readonly CatalogExercise[] = [
  // 상체 · 등
  item("seated-row-machine", "시티드 로우 머신", "등", "머신", "7I6LNUG", ["시티드로우", "머신로우", "seatedrow"]),
  item("cable-seated-row", "케이블 시티드 로우", "등", "케이블", "fUBheHs", ["시티드로우", "케이블로우"]),
  item("barbell-row", "바벨 로우", "등", "바벨", "eZyBC3j", ["벤트오버로우", "barbellrow"]),
  item("dumbbell-row", "덤벨 로우", "등", "덤벨", "BJ0Hz5L", ["벤트오버덤벨로우", "dumbbellrow"]),
  item("pull-up", "풀업", "등", "맨몸", "0V2YQjW", ["턱걸이", "pullup"]),
  item("assisted-pull-up", "어시스티드 풀업", "등", "머신", "f4xtKBj", ["보조턱걸이", "어시스트풀업"]),
  // 상체 · 가슴
  item("barbell-bench-press", "벤치프레스", "가슴", "바벨", "EIeI8Vf", ["바벨벤치프레스", "벤치", "benchpress"]),
  item("dumbbell-bench-press", "덤벨 벤치프레스", "가슴", "덤벨", "SpYC0Kp", ["덤벨프레스"]),
  item("incline-dumbbell-press", "인클라인 덤벨 프레스", "가슴", "덤벨", "B3Rxp6L", ["인클라인프레스", "윗가슴"]),
  item("pec-deck-fly", "펙덱 플라이", "가슴", "머신", "v3xmPAR", ["머신플라이", "펙덱", "시티드플라이"]),
  item("cable-crossover", "케이블 크로스오버", "가슴", "케이블", "0CXGHya", ["크로스오버", "케이블플라이"]),
  // 상체 · 어깨
  item("lateral-raise", "사이드 레터럴 레이즈", "어깨", "덤벨", "DsgkuIt", ["레터럴레이즈", "사레레", "옆어깨"]),
  item("machine-lateral-raise", "머신 레터럴 레이즈", "어깨", "머신", "dRTfGZT", ["머신사레레"]),
  item("dumbbell-shoulder-press", "덤벨 숄더프레스", "어깨", "덤벨", "q7qkONO", ["덤벨프레스", "어깨프레스"]),
  item("rear-delt-raise", "리어 델트 레이즈", "어깨", "덤벨", "mu5Guxt", ["후면어깨", "뒷어깨", "리어델트"]),
  item("front-raise", "프론트 레이즈", "어깨", "덤벨", "3eGE2JC", ["앞어깨", "frontraise"]),
  // 상체 · 팔
  item("barbell-curl", "바벨 컬", "팔", "바벨", "25GPyDY", ["이두", "바벨컬", "biceps"]),
  item("dumbbell-curl", "덤벨 컬", "팔", "덤벨", "NbVPDMW", ["이두", "덤벨컬", "biceps"]),
  item("hammer-curl", "해머 컬", "팔", "덤벨", "2NpxjC1", ["이두", "해머컬"]),
  item("preacher-curl-machine", "프리처 컬 머신", "팔", "머신", "b6hQYMb", ["이두", "머신컬", "프리처컬"]),
  item("triceps-pushdown", "케이블 푸시다운", "팔", "케이블", "3ZflifB", ["삼두", "푸시다운", "triceps"]),
  item("skull-crusher", "스컬 크러셔", "팔", "바벨", "h8LFzo9", ["삼두", "라잉트라이셉스익스텐션", "스컬크러셔"]),
  item("overhead-triceps-extension", "케이블 오버헤드 익스텐션", "팔", "케이블", "2IxROQ1", ["삼두", "오버헤드트라이셉스"]),
  // 하체 · 허벅지
  item("leg-extension", "레그 익스텐션", "허벅지", "머신", "my33uHU", ["앞벅지", "대퇴사두", "legextension"]),
  item("leg-curl", "라잉 레그 컬", "허벅지", "머신", "17lJ1kr", ["레그컬", "햄스트링", "뒷벅지", "legcurl"]),
  item("dumbbell-lunge", "덤벨 런지", "허벅지", "덤벨", "ecl28tP", ["런지", "lunge"]),
  // 하체 · 엉덩이
  item("deadlift", "데드리프트", "엉덩이", "바벨", "ila4NZS", ["바벨데드리프트", "deadlift"]),
  item("romanian-deadlift", "루마니안 데드리프트", "엉덩이", "바벨", "wQ2c4XD", ["RDL", "스티프레그", "햄스트링"]),
  item("glute-bridge", "바벨 글루트 브릿지", "엉덩이", "바벨", "qKBpF7I", ["힙브릿지", "힙쓰러스트", "둔근", "gluteBridge"]),
  // 하체 · 종아리
  item("seated-calf-raise", "시티드 카프 레이즈", "종아리", "머신", "bOOdeyc", ["카프레이즈", "종아리", "calf"]),
  item("standing-calf-raise", "스탠딩 카프 레이즈", "종아리", "바벨", "8ozhUIZ", ["카프레이즈", "종아리", "calf"]),
];

/** 검증된 전체 운동: 기존 샘플 7개 + 확장 */
export const CATALOG: readonly CatalogExercise[] = [...BASE_CATALOG, ...EXTRA_CATALOG];

export function findCatalog(key: string): CatalogExercise | null {
  return CATALOG.find((c) => c.key === key) ?? null;
}

/** 비교용으로 소문자로 바꾸고 공백·기호를 뺀다 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-_.·]/g, "");
}

/** 운동이 속한 큰 구분(세부 부위로 정해진다) */
export function regionOf(c: CatalogExercise): Region {
  return (REGIONS.find((r) => REGION_PARTS[r].includes(c.bodyPart)) ?? "상체") as Region;
}

export type SearchFilter = {
  query?: string;
  /** 상체/하체 */
  region?: Region | null;
  /** 세부 부위(등·가슴·어깨·허벅지·엉덩이) */
  bodyPart?: BodyPart | null;
  equipment?: Equipment | null;
};

/**
 * 한국어 운동 목록에서 찾는다. 이름·다른 이름·부위·기구 어느 쪽에 맞아도 나온다.
 * 검색어가 비면 부위·기구 조건만 적용한다. 외부 API는 부르지 않는다.
 */
export function searchCatalog(filter: SearchFilter = {}): CatalogExercise[] {
  const q = normalize(filter.query ?? "");
  return CATALOG.filter((c) => {
    if (filter.region && regionOf(c) !== filter.region) return false;
    if (filter.bodyPart && c.bodyPart !== filter.bodyPart) return false;
    if (filter.equipment && c.equipment !== filter.equipment) return false;
    if (q === "") return true;
    return [c.name, regionOf(c), c.bodyPart, c.equipment, ...c.aliases].some((t) => normalize(t).includes(q));
  });
}

/** 고른 운동 하나로 임시 루틴을 만든다(저장하지 않고 바로 기존 타이머에 연결한다) */
export function makeTempRoutine(c: CatalogExercise): Routine {
  const exercise: Exercise = {
    id: c.key,
    name: c.name,
    reps: DEFAULTS.reps,
    sets: DEFAULTS.sets,
    restSec: DEFAULTS.restSec,
    tempoSec: DEFAULTS.tempoSec,
    weightKg: DEFAULTS.weightKg,
  };
  return { id: `temp-${c.key}`, name: c.name, exercises: [exercise] };
}
