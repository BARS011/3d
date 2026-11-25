# Form3D — professional 3D / 2D studiya

Rasm yoki bir nechta rasmni brauzerda 3D model va 2D web dizaynga aylantiradigan ko‘p sahifali sayt.

## Sahifalar

| Fayl | Vazifa |
|---|---|
| `index.html` | Bosh sahifa — imkoniyatlar, namunalar, qo‘llanma, CTA |
| `3d.html` | 3D studiya — ko‘p rasm, asosiy ob’ektni ajratish, AI 4 tomon (oldin 4 ko‘rinish, keyin model), relyef, GLB/OBJ/STL |
| `2d.html` | 2D Web studiya — qatlamlar, fonni olib tashlash, PNG/WebP/SVG |
| `how-it-works.html` | Bosqichma-bosqich qo‘llanma |
| `features.html` | Imkoniyatlar va eksport formatlari |
| `faq.html` | Savollar va javoblar |

## Asosiy yaxshilanishlar

- **Faqat asosiy ob’ekt.** `assets/js/relief.js` dagi `segment()` fon rangini klasterlash (k-means), rang masofasi, chegaraga ulanish va o‘lcham bo‘yicha filtrlash yordamida markaziy ob’ektni ajratadi. Fondagi boshqa buyumlar o‘chiriladi, so‘ngra `cropToSubject()` rasmni ob’ekt atrofida qirqib, teksturaga faqat ob’ekt kiritiladi.
- **Avtomatik yaratish.** Rasm yuklagan zahoti 3D model quriladi — “3D model yaratish” tugmasi qo‘lda qayta qurish uchun qoladi. Jarayon va natija holati sahifada aniq ko‘rsatiladi.
- **Bir nechta rasm.** 8 tagacha rasm yuklanadi. “Avtomatik” rejim eng yaxshi rasmni asosiy old tomon sifatida tanlaydi (miniaturaga bosib o‘zgartirish mumkin), qolgan rasmlar AI 4 tomon rejimida haqiqiy orqa va yon ko‘rinishlar sifatida ishlatiladi. Ustma-ust, katak, yonma-yon va faqat birinchi rasm rejimlari ham mavjud.
- **AI 4 tomon (ikki bosqichli).** `three-studio.js` dagi `inferViewParams()` ob’ektni tahlil qilib (real AI muhiti `window.claude` bo‘lsa — AI orqali, aks holda mahalliy taxmin), `makeViews()` esa old/orqa/chap/o‘ng ko‘rinishlarini yaratadi va ularni ekranda ko‘rsatadi. Keyin `relief.js` dagi `full360` rejimi **aynan shu 4 ko‘rinish** asosida tekstura va chuqurlik xaritalarini quradi. Yumshoq chekka (bevel), yopiq devorlar va alohida chuqurlik xaritalari modelni hamma tomondan to‘liq va silliq qiladi.
- **Rasmga moslik.** Old yuz tekis saqlanib, faqat kontur bo‘ylab yumshoq egiladi; mahalliy kontrast asosidagi detallar va emissive tekstura rasm ranglarini asl ko‘rinishiga yaqinlashtiradi. Tarmoq aniqligi optimallashtirilgan — ZIP eksporti oddiy brauzerda ham yuklanadi.
- **To‘liq sozlash.** Eni, bo‘yi, qalinligi, X/Y/Z aylanishlari joniy; qalinlik, detallik, silliqlik, fon sezuvchanligi va ajratish darajasi qayta qurish bilan.
- **2D studiya.** Qatlamlar, masshtab/burish/shaffoflik, fonni olib tashlash, 6 filtr, web o‘lchamlari, PNG/WebP/SVG va panelyarga nusxalash.
- **Professional UI.** Qorong‘u/yorug‘ tema, mobil menyu, scroll animatsiyalari, toast xabarlar, umumiy header/footer.

## Ishga tushirish

Fayllarni statik server bilan oching (masalan `python -m http.server 8000`) yoki to‘g‘ridan-to‘g‘ri `index.html` ni brauzerda oching. Three.js, OrbitControls, eksportchilar va JSZip `assets/vendor/` papkasida mahalliy saqlangan — 3D studiya internetsiz ham ishlaydi.

Eski yagona faylli versiya (`Form3D - Rasmdan 3D model.html`) saqlab qolindi.
