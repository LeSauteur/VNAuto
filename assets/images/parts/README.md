# Автозапчасти: структура изображений

## Текущая схема
Сейчас карточки в `index.html` используют временные изображения из папки:

- `assets/images/parts/placeholders/`

Это сделано для единого аккуратного вида до загрузки реальных фото.

## Куда загружать реальные фото
Реальные изображения складывать в папку:

- `assets/images/parts/real/`

Рекомендуемый формат: `.jpg` или `.webp`.
Рекомендуемая пропорция: 16:10 или 16:9.
Минимальная ширина: 1200 px.

## Рекомендуемые имена файлов
- `headlight-bulbs.jpg`
- `washer-fluid.jpg`
- `motor-oil.jpg`
- `filters.jpg`
- `brake-pads.jpg`
- `battery.jpg`
- `spark-plugs.jpg`
- `timing-belt.jpg`
- `shock-absorbers.jpg`
- `tires.jpg`
- `wheels.jpg`
- `wipers.jpg`

## Соответствие карточек и файлов
- Лампы для фар -> `headlight-bulbs.jpg`
- Стеклоомывающая жидкость -> `washer-fluid.jpg`
- Моторные масла -> `motor-oil.jpg`
- Фильтры -> `filters.jpg`
- Тормозные колодки -> `brake-pads.jpg`
- Аккумуляторы -> `battery.jpg`
- Свечи зажигания -> `spark-plugs.jpg`
- Ремень ГРМ -> `timing-belt.jpg`
- Амортизаторы -> `shock-absorbers.jpg`
- Шины -> `tires.jpg`
- Диски -> `wheels.jpg`
- Щетки стеклоочистителя -> `wipers.jpg`

## Как заменить без переделки верстки
1. Скопировать реальные файлы в `assets/images/parts/real/`.
2. В блоке `#parts` файла `index.html` заменить путь
   с `assets/images/parts/placeholders/...-placeholder.svg`
   на `assets/images/parts/real/... .jpg`.
3. Имена карточек и остальная структура остаются без изменений.
