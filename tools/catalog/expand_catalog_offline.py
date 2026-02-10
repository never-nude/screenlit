#!/usr/bin/env python3

import re, datetime

ADD_TITLES = [
    # FILM — mainstream & relational
    ("film_sound_of_music_1965","The Sound of Music","Film",1965),
    ("film_mary_poppins_1964","Mary Poppins","Film",1964),
    ("film_grease_1978","Grease","Film",1978),
    ("film_terms_of_endearment_1983","Terms of Endearment","Film",1983),
    ("film_kramer_vs_kramer_1979","Kramer vs. Kramer","Film",1979),
    ("film_rain_man_1988","Rain Man","Film",1988),
    ("film_sleepless_in_seattle_1993","Sleepless in Seattle","Film",1993),
    ("film_youve_got_mail_1998","You've Got Mail","Film",1998),
    ("film_love_actually_2003","Love Actually","Film",2003),
    ("film_my_big_fat_greek_wedding_2002","My Big Fat Greek Wedding","Film",2002),
    ("film_moonlight_2016","Moonlight","Film",2016),
    ("film_little_women_2019","Little Women","Film",2019),
    ("film_nomadland_2020","Nomadland","Film",2020),
    ("film_everything_everywhere_2022","Everything Everywhere All at Once","Film",2022),

    # TV — broad recognition
    ("tv_golden_girls_1985","The Golden Girls","TV",1985),
    ("tv_gilmore_girls_2000","Gilmore Girls","TV",2000),
    ("tv_desperate_housewives_2004","Desperate Housewives","TV",2004),
    ("tv_big_little_lies_2017","Big Little Lies","TV",2017),
    ("tv_this_is_us_2016","This Is Us","TV",2016),
    ("tv_the_good_place_2016","The Good Place","TV",2016),
    ("tv_the_white_lotus_2021","The White Lotus","TV",2021),
    ("tv_the_marvelous_mrs_maisel_2017","The Marvelous Mrs. Maisel","TV",2017),

    # BOOKS — bookstore staples
    ("book_eat_pray_love_2006","Eat, Pray, Love","Book",2006),
    ("book_where_crawdads_sing_2018","Where the Crawdads Sing","Book",2018),
    ("book_little_fires_everywhere_2017","Little Fires Everywhere","Book",2017),
    ("book_big_little_lies_2014","Big Little Lies","Book",2014),
    ("book_normal_people_2018","Normal People","Book",2018),
    ("book_circe_2018","Circe","Book",2018),
    ("book_song_of_achilles_2011","The Song of Achilles","Book",2011),
]

with open("SL30/catalog.js","r",encoding="utf-8") as f:
    src = f.read()

existing = set(re.findall(r'id:"([^"]+)"', src))

new_entries = []
for i,t,m,y in ADD_TITLES:
    if i not in existing:
        new_entries.append(f'    {{ id:"{i}", title:"{t}", type:"{m}", year:{y} }}')

backup = "SL30/catalog.js.bak_expand_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
with open(backup,"w",encoding="utf-8") as f:
    f.write(src)

insert_at = src.rfind("];")
if insert_at == -1:
    raise RuntimeError("Could not find insertion point")

out = src[:insert_at] + ",\n" + ",\n".join(new_entries) + "\n" + src[insert_at:]
with open("SL30/catalog.js","w",encoding="utf-8") as f:
    f.write(out)

print(f"Added {len(new_entries)} entries. Backup written to {backup}.")
