import express from "express";
import path from 'path';
import fs from "fs";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(__dirname));

/**
 * 두 문자열 사이의 Levenshtein 거리를 계산합니다.
 * Levenshtein 거리는 한 문자열을 다른 문자열로 변경하는 데 필요한
 * 최소 편집 연산(삽입, 삭제, 대체)의 수를 의미합니다.
 *
 * @param s - 첫 번째 문자열.
 * @param t - 두 번째 문자열.
 * @returns 두 문자열 사이의 Levenshtein 거리.
 */
function levenshteinDistance(s: string, t: string) {
    const n: number = s.length;
    const m: number = t.length;
    const d: number[][] = Array.from(Array(n + 1), () => Array(m + 1).fill(0));

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) d[i][0] = i;
    for (let j = 0; j <= m; j++) d[0][j] = j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }

    return d[n][m];
}

/**
 * 문자열을 개별 문자로 분해합니다. 문자가 한글 음절인 경우,
 * 자모로 분해합니다.
 *
 * @param str - 입력 문자열.
 * @returns 분해된 문자열.
 */
function decompose(str: string) {
    const HANGUL_OFFSET = 0xAC00;
    const INITIAL_OFFSET = 0x1100;
    const MEDIAL_OFFSET = 0x1161;
    const FINAL_OFFSET = 0x11A7;

    const initialConsonants = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];

    const medialVowels = [
        'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
    ];

    const finalConsonants = [
        '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];

    return str.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code >= HANGUL_OFFSET && code <= 0xD7A3) {
            // 한글 음절인 경우 초성, 중성, 종성으로 분해
            const offsetCode = code - HANGUL_OFFSET;
            const initialIndex = Math.floor(offsetCode / 588);
            const medialIndex = Math.floor((offsetCode % 588) / 28);
            const finalIndex = offsetCode % 28;

            return initialConsonants[initialIndex] + medialVowels[medialIndex] + finalConsonants[finalIndex];
        }
        return char; // 한글 음절이 아닌 경우 그대로 반환
    }).join('');
}

/**
 * Levenshtein 거리를 사용하여 두 문자열을 비교하고 0과 1 사이의 유사도 점수를 반환합니다.
 * 점수는 (maxLen - distance) / maxLen으로 계산되며, 여기서 maxLen은 더 긴 문자열의 길이입니다.
 *
 * @param string1 - 첫 번째 문자열.
 * @param string2 - 두 번째 문자열.
 * @returns 두 문자열 사이의 유사도 점수.
 */
function compareTwoStrings(string1: string, string2: string) {
    const decomposedString1 = decompose(string1.toLowerCase());
    const decomposedString2 = decompose(string2.toLowerCase());
    const distance = levenshteinDistance(decomposedString1, decomposedString2);
    const maxLen = Math.max(decomposedString1.length, decomposedString2.length);
    return (maxLen - distance) / maxLen;
}

const menuKeywords = {
    "아메리카노": ["아메리카노", "아멜카노"],
    "디카페인 아메리카노": ["디카페인아메리카노", "아멜카노"],
    "카페라떼": ["카페라떼"],
    "카푸치노": ["카푸치노"],
    "카페오레": ["카페오레"],
    "카페모카": ["카페모카"],
    "바닐라라떼": ["바닐라라떼"],
    "카라멜마끼아또": ["카라멜마끼아또"],
    "블루마운틴": ["블루마운틴"],
    "아포가토": ["아포가토"],
    "아인슈패너": ["아인슈패너"],
    "클래식 아포가토": ["클래식 아포가토"],
    "화이트초콜릿모카": ["화이트초콜릿모카"],
    "민트초코라떼": ["민트초코라떼"],
    "딸기라떼": ["딸기라떼"],
    "레몬티": ["레몬티"],
    "자몽차": ["자몽차"],
    "캐모마일티": ["캐모마일티"],
    "페퍼민트티": ["페퍼민트티"],
    "얼그레이티": ["얼그레이티"],
    "캐모마일레몬티": ["캐모마일레몬티"],
};

const temperatureKeywords = {
    "핫": ["HOT", "hot", "핫", "뜨거운", "따뜻한"],
    "아이스": ["ICE", "ice", "아이스", "차가운", "시원한"]
};

const sizeKeywords = {
    "톨": ["Tall", "톨", "톨사이즈", "Tall"],
    "그란데": ["Grande", "그란데", "그란데사이즈", "Grande"],
    "벤티": ["Venti", "벤티", "벤티사이즈", "Venti"]
};

const coffeeBeanKeywords = {
    "마일드로스트": ["마일드로스트", "마일드"],
    "다크로스트": ["다크로스트", "다크"]
};

const syrupKeywords = {
    "바닐라시럽": ["바닐라시럽", "시럽바닐라"],
    "카라멜시럽": ["카라멜시럽", "시럽카라멜"],
    "모카시럽": ["모카시럽", "시럽모카"]
};

const drizzleKeywords = {
    "바닐라드리즐": ["바닐라드리즐", "드리즐바닐라"],
    "카라멜드리즐": ["카라멜드리즐", "드리즐카라멜", "캬라멜드리즐", "드리즐캬라멜"],
    "모카드리즐": ["모카드리즐", "드리즐모카"]
};

const amountKeywords = {
    "적게": ["적게", "조금", "less"],
    "보통": ["보통", "일반", "regular"],
    "많이": ["많이", "extra"]
};

/**
 * 입력 문자열과 키워드 세트에서 최적의 매칭을 찾습니다.
 * 최적의 매칭은 가장 높은 유사도 점수를 가진 키워드입니다.
 *
 * @param input - 입력 문자열.
 * @param keywords - 키워드 변형 배열을 값으로 갖는 객체.
 * @returns 유사도가 임계값을 초과하는 경우 최적의 매칭 키워드, 그렇지 않으면 null.
 */
function findBestMatch(input: string, keywords: { [key: string]: string[] }) {
    let bestMatch = { key: "", similarity: 0 };
    for (const key in keywords) {
        for (const keyword of keywords[key]) {
            const similarity = compareTwoStrings(input, keyword);
            if (similarity > bestMatch.similarity) {
                bestMatch = { key, similarity };
            }
        }
    }
    return bestMatch.similarity > 0.7 ? bestMatch.key : null;
}

/**
 * 옵션 코드를 생성합니다.
 * 각 옵션에 대해 고유한 코드를 생성하여 문자열 형태로 반환합니다.
 *
 * @param options - 선택된 옵션들.
 * @returns 생성된 옵션 코드.
 */
function generateOptionCode(options: { [key: string]: any }) {
    const {
        menu,
        temperature,
        size,
        coffeeBean,
        syrup,
        syrupAmount,
        drizzle,
        drizzleAmount,
        // 기본값 추가
        caffeineLevel = '015', // 15%
        decafLevel = '000', // 0%
        powder = '0',
        powderAmount = '0',
        whippingCream = '0',
        milk = '0',
        milkAmount = '0',
        topping = '0',
        quantity = '1' // 기본 수량
    } = options;

    // 옵션 코드를 생성하여 반환
    return `${menu}-${temperature}-${size}-${coffeeBean}-${caffeineLevel}-${decafLevel}-${syrup}${syrupAmount}-${drizzle}${drizzleAmount}-${powder}${powderAmount}-${whippingCream}-${milk}${milkAmount}-${topping}-${quantity}`;
}

/**
 * 키워드의 인덱스를 반환합니다.
 * 
 * @param keyword - 키워드 문자열.
 * @param keywords - 키워드 객체.
 * @returns 키워드의 인덱스 (0 기반).
 */
function getKeywordIndex(keyword: string | null, keywords: { [key: string]: string[] }) {
    if (!keyword) return 0; // 키워드가 없는 경우 0을 반환 (기본값)
    const keys = Object.keys(keywords);
    const index = keys.indexOf(keyword);
    return index >= 0 ? index + 1 : 0; // 1 기반 인덱스를 반환
}
/**
 * 주문 입력 텍스트를 분석하여 미리 정의된 키워드에서 메뉴 항목, 온도, 사이즈 및 시럽을 식별합니다.
 * 주문을 성공적으로 분석한 경우 주문 확인 문자열을 구성하여 반환하며, 그렇지 않으면 오류 메시지를 반환합니다.
 *
 * @param inputText - 주문을 설명하는 입력 텍스트.
 * @returns 주문을 확인하는 문자열 또는 오류 메시지.
 */
function parseOrder(inputText: string) {
    let matchedKeywords: { [key: string]: string | null } = {
        menu: null,
        temperature: null,
        size: null,
        coffeeBean: null,
        syrup: null,
        syrupAmount: null,
        drizzle: null,
        drizzleAmount: null
    };

    const words = inputText.split(/\s+/);

    // 양 관련 키워드를 먼저 처리하여 시럽/드리즐 양에 반영
    let currentAmount: string | null = null;
    let isSyrupNext = false;
    let isDrizzleNext = false;

    for (const word of words) {
        if (!currentAmount) {
            currentAmount = findBestMatch(word, amountKeywords);
        }

        if (!matchedKeywords.menu) {
            matchedKeywords.menu = findBestMatch(word, menuKeywords);
        }
        if (!matchedKeywords.temperature) {
            matchedKeywords.temperature = findBestMatch(word, temperatureKeywords);
        }
        if (!matchedKeywords.size) {
            matchedKeywords.size = findBestMatch(word, sizeKeywords);
        }
        if (!matchedKeywords.coffeeBean) {
            matchedKeywords.coffeeBean = findBestMatch(word, coffeeBeanKeywords);
        }
        if (!matchedKeywords.syrup) {
            matchedKeywords.syrup = findBestMatch(word, syrupKeywords);
            if (matchedKeywords.syrup) {
                isSyrupNext = true;
            }
        }
        if (!matchedKeywords.drizzle) {
            matchedKeywords.drizzle = findBestMatch(word, drizzleKeywords);
            if (matchedKeywords.drizzle) {
                isDrizzleNext = true;
            }
        }

        if (isSyrupNext && currentAmount) {
            matchedKeywords.syrupAmount = currentAmount;
            currentAmount = null;
            isSyrupNext = false;
        } else if (isDrizzleNext && currentAmount) {
            matchedKeywords.drizzleAmount = currentAmount;
            currentAmount = null;
            isDrizzleNext = false;
        }
    }

    // 기본값 설정
    if (!matchedKeywords.temperature) {
        matchedKeywords.temperature = "아이스";
    }
    if (!matchedKeywords.size) {
        matchedKeywords.size = "벤티";
    }
    if (!matchedKeywords.syrupAmount) {
        matchedKeywords.syrupAmount = "보통";
    }
    if (!matchedKeywords.drizzleAmount) {
        matchedKeywords.drizzleAmount = "보통";
    }

    if (matchedKeywords.menu) { // 메뉴만 필수
        let order = `${matchedKeywords.temperature} ${matchedKeywords.menu} ${matchedKeywords.size}사이즈`;
        if (matchedKeywords.syrup) {
            order += `, ${matchedKeywords.syrup} ${matchedKeywords.syrupAmount} 추가`;
        }
        if (matchedKeywords.drizzle) {
            order += `, ${matchedKeywords.drizzle} ${matchedKeywords.drizzleAmount} 추가`;
        }

        const optionCode = generateOptionCode({
            menu: getKeywordIndex(matchedKeywords.menu, menuKeywords).toString().padStart(3, '0'),
            temperature: getKeywordIndex(matchedKeywords.temperature, temperatureKeywords).toString(),
            size: getKeywordIndex(matchedKeywords.size, sizeKeywords).toString(),
            coffeeBean: getKeywordIndex(matchedKeywords.coffeeBean, coffeeBeanKeywords).toString(),
            syrup: getKeywordIndex(matchedKeywords.syrup, syrupKeywords).toString(),
            syrupAmount: getKeywordIndex(matchedKeywords.syrupAmount, amountKeywords).toString(),
            drizzle: getKeywordIndex(matchedKeywords.drizzle, drizzleKeywords).toString(),
            drizzleAmount: getKeywordIndex(matchedKeywords.drizzleAmount, amountKeywords).toString()
        });

        return `${order} 주문받았습니다.\n옵션 코드: ${optionCode}`;
    } else {
        return "죄송합니다. 메뉴를 이해하지 못했습니다.";
    }
}

console.log(parseOrder("아메리카노 아이스 벤티사이즈 바닐라시럽 많이 카라멜드리즐 보통 추가해줘"));
console.log(parseOrder("아이스 디카페인 아메리카노 팬티사이즈로 줘"));
console.log(parseOrder("아메리카노"));
console.log(parseOrder("아메리카노 바닐라시럽 추가해줘"));
console.log(parseOrder("아메리카노 바닐라시럽 적게 추가해줘"));
console.log(parseOrder("아메리카노 바닐라시럽 많이 추가해줘 카라멜드리즐 보통 추가해줘"));

