#!/usr/bin/env python3

import re, datetime

ADD_TITLES = [

    # FILM — mainstream, widely known, not previously used
    ("film_west_side_story_1961","West Side Story","Film",1961),
    ("film_fiddler_roof_1971","Fiddler on the Roof","Film",1971),
    ("film_annie_hall_1977","Annie Hall","Film",1977),
    ("film_the_color_purple_1985","The Color Purple","Film",1985),
    ("film_working_girl_1988","Working Girl","Film",1988),
    ("film_dead_poets_society_1989","Dead Poets Society","Film",1989),
    ("film_fried_green_tomatoes_1991","Fried Green Tomatoes","Film",1991),
    ("film_four_weddings_funeral_1994","Four Weddings and a Funeral","Film",1994),
    ("film_the_english_patient_1996","The English Patient","Film",1996),
    ("film_as_good_as_it_gets_1997","As Good as It Gets","Film",1997),
    ("film_chocolat_2000","Chocolat","Film",2000),
    ("film_billy_elliot_2000","Billy Elliot","Film",2000),
    ("film_the_hours_2002","The Hours","Film",2002),
    ("film_eternal_sunshine_2004","Eternal Sunshine of the Spotless Mind","Film",2004),
    ("film_the_piano_1993","The Piano","Film",1993),
    ("film_juno_2007","Juno","Film",2007),
    ("film_the_reader_2008","The Reader","Film",2008),
    ("film_black_swan_2010","Black Swan","Film",2010),
    ("film_the_shape_of_water_2017","The Shape of Water","Film",2017),
    ("film_coda_2021","CODA","Film",2021),

    # TV — mainstream expansion
    ("tv_the_nanny_1993","The Nanny","TV",1993),
    ("tv_felicity_1998","Felicity","TV",1998),
    ("tv_veronica_mars_2004","Veronica Mars","TV",2004),
    ("tv_scandal_2012","Scandal","TV",2012),
    ("tv_the_americans_2013","The Americans","TV",2013),
    ("tv_outlander_2014","Outlander","TV",2014),
    ("tv_shameless_2011","Shameless","TV",2011),
    ("tv_the_handmaids_tale_2017","The Handmaid's Tale","TV",2017),
    ("tv_normal_people_2020","Normal People","TV",2020),
    ("tv_and_just_like_that_2021","And Just Like That...","TV",2021),

    # BOOKS — high-recognition
    ("book_bridges_madison_county_1992","The Bridges of Madison County","Book",1992),
    ("book_secret_life_bees_2001","The Secret Life of Bees","Book",2001),
    ("book_time_travelers_wife_2003","The Time Traveler's Wife","Book",2003),
    ("book_kite_runner_2003","The Kite Runner","Book",2003),
    ("book_lovely_bones_2002","The Lovely Bones","Book",2002),
    ("book_help_2009","The Help","Book",2009),
    ("book_gone_girl_2012_dup2","Gone Girl","Book",2012),
    ("book_goldfinch_2013","The Goldfinch","Book",2013),
    ("book_station_eleven_2014","Station Eleven","Book",2014),
    ("book_night_circus_2011","The Night Circus","Book",2011),
]

with open("SL30/catalog.js","r",encoding="utf-8") as f:
    src = f.read()

existing = set(re.findall(r'id:"([^"]+)"', src))

new_entries = []
for i,t,m,y in ADD_TITLES:
    if i not in existing:
        new_entries.append(f'    {{ id:"{i}", title:"{t}", type:"{m}", year:{y} }}')

backup = "SL30/catalog.js.bak_expand_final_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
with open(backup,"w",encoding="utf-8") as f:
    f.write(src)

insert_at = src.rfind("];")
if insert_at == -1:
    raise RuntimeError("Could not find insertion point")

out = src[:insert_at] + ",\n" + ",\n".join(new_entries) + "\n" + src[insert_at:]
with open("SL30/catalog.js","w",encoding="utf-8") as f:
    f.write(out)

print(f"Added {len(new_entries)} entries. Backup written to {backup}.")
