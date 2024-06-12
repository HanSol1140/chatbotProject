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
// 메뉴명을 길이별로 정렬
const sortedMenuKeywords = Object.entries(menuKeywords)
.sort(([keyA], [keyB]) => keyB.length - keyA.length)
.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
}, {} as typeof menuKeywords);



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


function findKeywords(inputText: string) {
    const keywords: { [key: string]: string | null } = {
        menu: null,
        temperature: null,
        size: null,
        coffeeBean: null,
        syrup: null,
        syrupAmount: null,
        powder: null,
        drizzle: null,
        caffeinLevel: null,
        quantity: null,
        whippingCream: null,
        whippingCreamAmount: null,
        milk: null,
        milkAmount: null,
        topping: null,
    };

    const decomposedText = decompose(inputText);
    for (const [keyword, { variations }] of Object.entries(sortedMenuKeywords)) {
        const allVariations = [keyword, ...variations];
        for (const variation of allVariations) {
            const decomposedVariation = decompose(variation);
            for (let i = 0; i <= decomposedText.length - decomposedVariation.length; i++) {
                const substring = decomposedText.slice(i, i + decomposedVariation.length);
                const similarity = compareTwoStrings(substring, decomposedVariation);
                if (similarity >= 0.7) {
                    keywords.menu = keyword;
                    break;
                }
            }
            if (keywords.menu) {
                break;
            }
        }

    }

    return keywords;
}
console.time("findKeywords");
console.log(menuKeywords);
console.log(findKeywords("레몬차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차자몽차"));
console.timeEnd("findKeywords");


