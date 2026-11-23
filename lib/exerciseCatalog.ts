// 검증된 운동 목록과 한국어 대응표 (확장 STEP 4~6)
// ExerciseDB 검색 결과를 그대로 쓰지 않고, 사람이 이름·부위·기구·동작을 확인한 운동만 여기에 올린다.
// 맞는 GIF가 없으면 다른 운동 GIF로 대신하지 않고 exerciseDbId를 null로 둔다(화면에는 GIF 없이 보인다).

import { DEFAULTS, type Exercise, type Routine } from "./routines";

/** 큰 구분: 운동 찾기의 첫 번째 칩 */
export type Region = "상체" | "하체";
/** 세부 부위: 큰 구분을 고르면 나오는 두 번째 칩이자 운동 카드의 태그 */
export type BodyPart = "등" | "가슴" | "어깨" | "허벅지" | "엉덩이";
export type Equipment = "머신" | "케이블" | "바벨";

/** 큰 구분별 세부 부위 */
export const REGION_PARTS: Record<Region, readonly BodyPart[]> = {
  상체: ["등", "가슴", "어깨"],
  하체: ["허벅지", "엉덩이"],
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
export const EQUIPMENTS: readonly Equipment[] = ["머신", "케이블", "바벨"];

/** 기존 샘플 운동 7개. 이름·부위·기구는 직접 정했고, GIF는 이름·기구·부위·동작 화면을 보고 골랐다. */
export const CATALOG: readonly CatalogExercise[] = [
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
