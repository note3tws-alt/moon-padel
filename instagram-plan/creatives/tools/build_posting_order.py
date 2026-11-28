import shutil, os
C='/mnt/project-files/moon-padel/instagram-plan/creatives'
OUT='/mnt/project-files/moon-padel/instagram-plan/posting-order'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
mp=lambda f:f'{C}/motion/mp4/{f}.mp4'; png=lambda f:f'{C}/png/{f}.png'
P=[ # (day, type, title, [files], caption, story note)
('L-15','Reel','Something big is coming',[mp('R00-something-big-is-coming'),png('R00-reel-cover-something-big')],'Something big is coming to Dubai. Turn on notifications.','Share the Reel to Stories with a question sticker: "What do you think it is?"'),
('L-14','Post','Something is rising',[png('P01-teaser-rising')],'Something is rising over Dubai. Turn on notifications.','Repost to Stories with a question sticker: "What do you think is coming?"'),
('L-13','Reel','The lights are coming on',[mp('R01a-lights-coming-on'),png('R01a-reel-cover-lights')],'The lights are coming on in Dubai. Soon.','Share to Stories with an emoji slider.'),
('L-12','Post','Every point gone',[png('P02-teaser-points')],'How many padel points did you win this year? Nobody kept count. Not for much longer.','Poll: "Do you know how many points you won this year?" Yes / No idea'),
('L-11','Reel','Every point will count',[mp('R01b-every-point-counts'),png('R01b-reel-cover-point')],'Every rally. Every point. This time it counts.','Share to Stories with a question box: "Guess what we\'re counting"'),
('L-10','Post','16 4 6 1',[png('P03-teaser-numbers')],'16. 4. 6. 1. Guesses in the comments.','Slider sticker: "How competitive are you?"'),
('L-9','Reel','The moon rises soon',[mp('R01c-moon-rises-soon'),png('R01c-reel-cover-moon')],'Watch the sky.','Share to Stories with a notify sticker.'),
('L-8','Post','Scores locked',[png('P04-teaser-secret-round')],"Round 6 is played in secret. You'll see why.",'Question box: "Round 6 is secret. What do you think that means?"'),
('L-7','Reel','16 players one podium',[mp('R01d-sixteen-players'),png('R01d-reel-cover-sixteen')],'16 players. 6 rounds. One podium. Coming to Dubai.',''),
('L-7','Story','7 days to moonrise',[png('P09-story-countdown-7')],'','Add the Instagram countdown sticker set to launch night.'),
('L-6','Post','The reveal',[png('P05-reveal')],'Moon Padel is here. Americano nights in Dubai with live scores on the big screen, a podium every night and points that stay with you forever. WhatsApp "MOON" to join the first night. #padeldubai','Share the reveal with a link sticker to WhatsApp MOON.'),
('L-6','Reel','Every point counts brand film',[mp('R06-brand-film-reveal'),png('R06-reel-cover-brand-film')],'Padel nights in Dubai where every point counts. Live scores, a podium every night, points that stay with you. WhatsApp "MOON" to join the first night.','Post about an hour after the reveal post. Collab with the venue if they agree.'),
('L-6','Story','Join the mission',[png('P10-story-join-mission')],'','Link sticker to WhatsApp MOON.'),
('L-5','Carousel','How a night works',[png(f) for f in ['P06-how-01-cover','P06-how-02-message','P06-how-03-league','P06-how-04-checkin','P06-how-05-rounds','P06-how-06-points','P06-how-07-reveal','P06-how-08-forever']],'How a Moon Padel night works, in 30 seconds. Save it, then send it to your padel group.','Reply to the best L-8 guesses about round 6.'),
('L-4','Reel','What is an Americano',[mp('R07-what-is-americano'),png('R07-reel-cover-americano')],"Never played an Americano? It's the easiest way into competitive padel. Send this to the friend who keeps saying they're not ready.",''),
('L-4','Story','Which league are you',[png('P11-story-league-quiz')],'','Use the quiz sticker.'),
('L-3','Carousel','From Earth to the Moon medals',[png(f) for f in ['P07-medals-01-cover','P07-medals-02-first-five','P07-medals-03-last-five','P07-medals-04-start']],'Every point you win, in every event, adds up. 10 real medals, from First Light to Moon Legend. Where will you be by summer?',''),
('L-3','Story','3 days',[png('P09-story-countdown-3')],'',''),
('L-2','Post','Find your league',[png('P08-find-your-league')],"D for beginners, C for intermediate. Not sure? Pick your best guess and we'll confirm it after your first night.",''),
('L-2','Story','Founding 16',[png('P13-story-founding-16')],'','CHECK FIRST: only post with the real confirmed player count.'),
('L-1','Post','First night poster',[png('P12-first-night-poster')],'Night 01. [DATE], [TIME], [VENUE]. 16 players, 4 courts, D League. AED [FEE]. WhatsApp "MOON" to confirm your spot.','CHECK FIRST: the poster and caption need the real date, time, venue and fee.'),
('L-1','Story','1 day',[png('P09-story-countdown-1')],'','Plus a Founding 16 update with the real count.'),
('L','Reel','Tonight',[mp('R08-moonrise-tonight'),png('R08-reel-cover-tonight')],'Full moon. First night. See you on court.','Post in the morning, not the evening.'),
('L','Story','Tonight',[png('P09-story-countdown-tonight')],'','Then the match-day Story set during the night.'),
]
md=['# Moon Padel launch: posting order','',
'Every file in this folder is numbered in the order it goes out. Files with the same number belong to one post (a Reel and its cover, or the slides of a carousel in order).','',
'**L** is launch night. Count back from the date you choose, so L-15 is 15 days before. Post feed at 8 to 10 PM Dubai time unless the note says otherwise. Stories go out the same day as the feed post above them.','',
'For a Reel, upload the MP4 and choose the PNG with the same number as the cover.','',
'| # | Day | Type | Files | Caption | Note |','|---|---|---|---|---|---|']
txt=[]
for i,(d,t,ti,fs,cap,note) in enumerate(P,1):
    n=f'{i:02d}'; names=[]
    for k,f in enumerate(fs,1):
        ext=os.path.splitext(f)[1]
        if t=='Carousel': suf=f' - slide {k} of {len(fs)}'
        elif t=='Reel': suf=' - video' if ext=='.mp4' else ' - cover'
        else: suf=''
        nm=f'{n} {d} {t} - {ti}{suf}{ext}'; shutil.copy(f,f'{OUT}/{nm}'); names.append(nm)
    md.append(f'| {n} | {d} | {t} | {len(names)} file{"s" if len(names)>1 else ""} | {cap or "(Story, no caption)"} | {note} |')
    txt += [f'{n}  {d}  {t}: {ti}', f'Caption: {cap}' if cap else 'Caption: none (Story)', *( [f'Note: {note}'] if note else []), '']
md+=['','After launch, follow the weekly rhythm in section 5 of the content plan. Those posts (event posters, podiums, medal cards) need real dates, names and scores, so they are filled in per event.']
open(f'{OUT}/00 Posting schedule.md','w').write('\n'.join(md)+'\n')
open(f'{OUT}/00 Captions to copy.txt','w').write('\n'.join(txt))
print(len(P), len(os.listdir(OUT)))
