import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import xlsx from "xlsx";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// 엑셀 파일 읽기
const workbook = xlsx.readFile(path.join(__dirname, "keywords.xlsx"));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 엑셀 데이터를 키워드 객체로 변환
const keywordsData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
const keywords: { [key: string]: { [key: string]: { variations: string[], stock: number | null } } } = {};
keywordsData.forEach((row: any) => {
    const category = row[0];
    const keyword = row[1];
    const variations = row[2] ? row[2].split(",").map((item: string) => item.trim()) : [];
    const stock = row[3] === "null" ? Infinity : parseInt(row[3]);

    if (!keywords[category]) {
        keywords[category] = {};
    }

    keywords[category][keyword] = { variations, stock };
});

// 키워드 객체
const menuKeywords = keywords["menu"];
const temperatureKeywords = keywords["temperature"];
const sizeKeywords = keywords["size"];
const coffeeBeanKeywords = keywords["coffeeBean"];
const caffeinLevelKeywords = keywords["caffeinLevel"];
// const decaffeinLevelKeywords = keywords["decaffeinLevel"]; // 미사용
const syrupKeywords = keywords["syrup"];
const powderKeywords = keywords["powder"];
const drizzleKeywords = keywords["drizzle"];
const whippingCreamKeywords = keywords["whippingCream"];
const milkKeywords = keywords["milk"];
const toppingKeywords = keywords["topping"];
const amountKeywords = keywords["amount"];
const quantityKeywords = keywords["quantity"];

console.log(keywords);

/**
 * 두 문자열 사이의 Levenshtein 거리를 계산합니다.
 * Levenshtein 거리는 한 문자열을 다른 문자열로 변경하는 데 필요한
 * 최소 편집 연산(삽입, 삭제, 대체)의 수를 의미합니다.
 *
 * @param s - 첫 번째 문자열.
 * @param t - 두 번째 문자열.
 * @returns 두 문자열 사이의 Levenshte인 거리.
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
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
    ];

    const medialVowels = [
        "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
    ];

    const finalConsonants = [
        "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
    ];

    return str
        .split("")
        .map((char) => {
            const code = char.charCodeAt(0);
            if (code >= HANGUL_OFFSET && code <= 0xd7a3) {
                // 한글 음절인 경우 초성, 중성, 종성으로 분해
                const offsetCode = code - HANGUL_OFFSET;
                const initialIndex = Math.floor(offsetCode / 588);
                const medialIndex = Math.floor((offsetCode % 588) / 28);
                const finalIndex = offsetCode % 28;

                return initialConsonants[initialIndex] + medialVowels[medialIndex] + finalConsonants[finalIndex];
            }
            return char; // 한글 음절이 아닌 경우 그대로 반환
        })
        .join("");
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
        caffeineLevel = "015", // 15%
        decafLevel = "000", // 0%
        powder = "0",
        whippingCreamAmount = "0", // 휘핑크림 양만 표시
        milk = "0",
        milkAmount = "0",
        topping = "0",
        quantity = "1", // 기본 수량
    } = options;

    // 시럽이 선택되지 않은 경우 시럽 양을 0으로 설정
    const finalSyrupAmount = syrup === "0" ? "0" : syrupAmount;
    // 휘핑크림이 선택되지 않은 경우 휘핑크림 양을 0으로 설정
    const finalWhippingCreamAmount = options.whippingCreamAmount === "0" ? "0" : whippingCreamAmount;
    // 우유가 선택되지 않은 경우 우유 양을 0으로 설정
    const finalMilkAmount = milk === "0" ? "0" : milkAmount;

    // 옵션 코드를 생성하여 반환 (휘핑크림은 양만, 드리즐은 단일 코드로)
    return `${menu}-${temperature}-${size}-${coffeeBean}-${caffeineLevel}-${decafLevel}-${syrup}${finalSyrupAmount}-${drizzle}-${powder}-${finalWhippingCreamAmount}-${milk}${finalMilkAmount}-${topping}-${quantity}`;
}


/**
 * 키워드의 인덱스를 반환합니다.
 *
 * @param keyword - 키워드 문자열.
 * @param keywords - 키워드 객체.
 * @returns 키워드의 인덱스 (0 기반).
 */
function getKeywordIndex(keyword: string | null, keywords: { [key: string]: { variations: string[], stock: number | null } }) {
    if (!keyword) return 0; // 키워드가 없는 경우 0을 반환 (기본값)
    const keys = Object.keys(keywords);
    const index = keys.indexOf(keyword);
    return index >= 0 ? index + 1 : 0; // 1 기반 인덱스를 반환
}




/**
 * 입력 문자열과 키워드 세트에서 최적의 매칭을 찾습니다.
 * 최적의 매칭은 가장 높은 유사도 점수를 가진 키워드입니다.
 *
 * @param inputWord - 입력 문자열.
 * @param keywords - 키워드 변형 배열을 값으로 갖는 객체.
 * @returns 유사도가 임계값을 초과하는 경우 최적의 매칭 키워드, 그렇지 않으면 null.
 */
const priorityMatch = (inputWord: any, keywords: any) => {
    let bestMatch: any = null;
    let highestSimilarity = 0;
    for (const key in keywords) {
        if (inputWord === key) {
            return key;
        }
        for (const variation of keywords[key].variations) {
            const similarity = compareTwoStrings(inputWord, variation);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = key;
            }
        }
    }
    return highestSimilarity >= 0.7 ? bestMatch : null;
};

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
        syrupAmount: "보통", // 기본값 설정
        powder: null,
        drizzle: null,
        caffeinLevel: "15%", // 기본값 설정 (15%)
        quantity: "1개", // 기본값 설정
        whippingCream: null,
        whippingCreamAmount: "0", // 기본값 0으로 설정 (사용 안 함)
        milk: null,
        milkAmount: "0", // 기본값 0으로 설정
        topping: null,
    };

    const words = inputText.split(/\s+/);

    let currentAmount: any = null;
    let isSyrupNext = false;
    let isDrizzleNext = false;
    let isWhippingCreamNext = false;
    let isMilkNext = false;

    for (const word of words) {
        if (!currentAmount) {
            currentAmount = priorityMatch(word, amountKeywords);
        }

        const menuMatch = priorityMatch(word, menuKeywords);
        if (menuMatch) {
            matchedKeywords.menu = menuMatch;
        }

        const temperatureMatch = priorityMatch(word, temperatureKeywords);
        if (temperatureMatch) {
            matchedKeywords.temperature = temperatureMatch;
        }

        const sizeMatch = priorityMatch(word, sizeKeywords);
        if (sizeMatch) {
            matchedKeywords.size = sizeMatch;
        }

        const coffeeBeanMatch = priorityMatch(word, coffeeBeanKeywords);
        if (coffeeBeanMatch) {
            matchedKeywords.coffeeBean = coffeeBeanMatch;
        }

        const caffeinLevelMatch = priorityMatch(word, caffeinLevelKeywords);
        if (caffeinLevelMatch) {
            matchedKeywords.caffeinLevel = caffeinLevelMatch;
        }

        const syrupMatch = priorityMatch(word, syrupKeywords);
        if (syrupMatch) {
            matchedKeywords.syrup = syrupMatch;
            isSyrupNext = true;
        }

        const powderMatch = priorityMatch(word, powderKeywords);
        if (powderMatch) {
            matchedKeywords.powder = powderMatch;
        }

        const drizzleMatch = priorityMatch(word, drizzleKeywords);
        if (drizzleMatch) {
            matchedKeywords.drizzle = drizzleMatch;
            isDrizzleNext = true;
        }

        const whippingCreamMatch = priorityMatch(word, whippingCreamKeywords);
        if (whippingCreamMatch) {
            matchedKeywords.whippingCream = whippingCreamMatch;
            isWhippingCreamNext = true;
        }

        const milkMatch = priorityMatch(word, milkKeywords);
        if (milkMatch) {
            matchedKeywords.milk = milkMatch;
            isMilkNext = true;
        }

        const toppingMatch = priorityMatch(word, toppingKeywords);
        if (toppingMatch) {
            matchedKeywords.topping = toppingMatch;
        }

        if (isSyrupNext && currentAmount) {
            matchedKeywords.syrupAmount = currentAmount;
            currentAmount = null;
            isSyrupNext = false;
        }

        if (isWhippingCreamNext && currentAmount) {
            matchedKeywords.whippingCreamAmount = currentAmount;
            currentAmount = null;
            isWhippingCreamNext = false;
        }

        if (isMilkNext && currentAmount) {
            matchedKeywords.milkAmount = currentAmount;
            currentAmount = null;
            isMilkNext = false;
        }

        const quantityMatch = priorityMatch(word, quantityKeywords);
        if (quantityMatch) {
            matchedKeywords.quantity = quantityMatch;
        }
    }

    // 기본값 설정 보완
    matchedKeywords.milkAmount = matchedKeywords.milk ? matchedKeywords.milkAmount : "0";
    matchedKeywords.syrupAmount = matchedKeywords.syrupAmount || "보통";
    matchedKeywords.whippingCreamAmount = matchedKeywords.whippingCream ? matchedKeywords.whippingCreamAmount : "0";
    matchedKeywords.caffeinLevel = matchedKeywords.caffeinLevel || "15%";
    matchedKeywords.quantity = matchedKeywords.quantity || "1개";

    if (!matchedKeywords.temperature) {
        matchedKeywords.temperature = "아이스";
    }
    if (!matchedKeywords.size) {
        matchedKeywords.size = "벤티";
    }

    if (matchedKeywords.menu) {
        const menuStock = menuKeywords[matchedKeywords.menu]?.stock;
        if (menuStock !== null && menuStock <= 0) {
            return `${matchedKeywords.menu}의 재고가 부족합니다.`;
        }

        let order = `${matchedKeywords.temperature} ${matchedKeywords.menu} ${matchedKeywords.size}사이즈`;

        if (matchedKeywords.coffeeBean) {
            const coffeeBeanStock = coffeeBeanKeywords[matchedKeywords.coffeeBean]?.stock;
            if (coffeeBeanStock !== null && coffeeBeanStock <= 0) {
                return `${matchedKeywords.coffeeBean} 원두의 재고가 부족합니다.`;
            }
            order += `, ${matchedKeywords.coffeeBean} 원두 사용`;
        }

        if (matchedKeywords.caffeinLevel) {
            order += `, 카페인 함량 ${caffeinLevelKeywords[matchedKeywords.caffeinLevel]?.variations[0] || matchedKeywords.caffeinLevel}`;
        }
        if (matchedKeywords.syrup) {
            const syrupStock = syrupKeywords[matchedKeywords.syrup]?.stock;
            if (syrupStock !== null && syrupStock <= 0) {
                return `${matchedKeywords.syrup}의 재고가 부족합니다.`;
            }
            order += `, ${matchedKeywords.syrup} ${matchedKeywords.syrupAmount} 추가`;
        }
        if (matchedKeywords.powder) {
            const powderStock = powderKeywords[matchedKeywords.powder]?.stock;
            if (powderStock !== null && powderStock <= 0) {
                return `${matchedKeywords.powder}의 재고가 부족합니다.`;
            }
            order += `, ${matchedKeywords.powder} 추가`;
        }
        if (matchedKeywords.drizzle) {
            const drizzleStock = drizzleKeywords[matchedKeywords.drizzle]?.stock;
            if (drizzleStock !== null && drizzleStock <= 0) {
                return `${matchedKeywords.drizzle}의 재고가 부족합니다.`;
            }
            order += ` ${matchedKeywords.drizzle} 추가`;
        }
        if (matchedKeywords.whippingCream) {
            const whippingCreamStock = whippingCreamKeywords[matchedKeywords.whippingCream]?.stock;
            if (whippingCreamStock !== null && whippingCreamStock <= 0) {
                return `${matchedKeywords.whippingCream}의 재고가 부족합니다.`;
            }
            order += `, 휘핑크림 ${matchedKeywords.whippingCreamAmount} 추가`;
        }
        if (matchedKeywords.milk) {
            const milkStock = milkKeywords[matchedKeywords.milk]?.stock;
            if (milkStock !== null && milkStock <= 0) {
                return `${matchedKeywords.milk}의 재고가 부족합니다.`;
            }
            order += `, ${matchedKeywords.milk} ${matchedKeywords.milkAmount} 추가`;
        }
        if (matchedKeywords.topping) {
            const toppingStock = toppingKeywords[matchedKeywords.topping]?.stock;
            if (toppingStock !== null && toppingStock <= 0) {
                return `${matchedKeywords.topping}의 재고가 부족합니다.`;
            }
            order += `, ${matchedKeywords.topping} 추가`;
        }
        if (matchedKeywords.quantity) {
            order += `, ${matchedKeywords.quantity}`;
        }

        const optionCode = generateOptionCode({
            menu: getKeywordIndex(matchedKeywords.menu, menuKeywords).toString().padStart(3, "0"),
            temperature: getKeywordIndex(matchedKeywords.temperature, temperatureKeywords).toString(),
            size: getKeywordIndex(matchedKeywords.size, sizeKeywords).toString(),
            coffeeBean: getKeywordIndex(matchedKeywords.coffeeBean, coffeeBeanKeywords).toString(),
            caffeinLevel: getKeywordIndex(matchedKeywords.caffeinLevel, caffeinLevelKeywords).toString(),
            syrup: getKeywordIndex(matchedKeywords.syrup, syrupKeywords).toString(),
            syrupAmount: getKeywordIndex(matchedKeywords.syrupAmount, amountKeywords).toString(),
            drizzle: getKeywordIndex(matchedKeywords.drizzle, drizzleKeywords).toString(),
            powder: getKeywordIndex(matchedKeywords.powder, powderKeywords).toString(),
            whippingCreamAmount: getKeywordIndex(matchedKeywords.whippingCreamAmount, amountKeywords).toString(),
            milk: getKeywordIndex(matchedKeywords.milk, milkKeywords).toString(),
            milkAmount: getKeywordIndex(matchedKeywords.milkAmount, amountKeywords).toString(),
            topping: getKeywordIndex(matchedKeywords.topping, toppingKeywords).toString(),
            quantity: getKeywordIndex(matchedKeywords.quantity, quantityKeywords).toString(),
        });

        return `${order} 주문받았습니다.\n옵션 코드: ${optionCode}`;
    } else {
        return "죄송합니다. 주문을 이해하지 못했습니다.";
    }
}

// 테스트 주문
console.log(parseOrder("아메리카노"));
console.log(parseOrder("아이스 아메리카노 아라비카원두에 농도는 20% 맞춰주고 바닐라시럽 적게 바닐라 드리즐, 바닐라 파우더, 휘핑크림 보통에 오트밀우유 많이 추가, 토핑은 쿠키로 2잔 줘"));
console.log(parseOrder("아메리카노 바닐라시럽 많이 오트밀우유 적게 줘"));
console.log(parseOrder("아메리카노 바닐라시럽 보통 오트밀우유 많이 줘"));