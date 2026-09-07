-- ══════════════════════════════════════════════════════════════════
-- TJ WordLoop Hub — schema Supabase cho chế độ Cloud
-- ══════════════════════════════════════════════════════════════════
-- Cách dùng:
--   1. Vào dashboard Supabase project của bạn → SQL Editor → New query
--   2. Dán TOÀN BỘ file này vào → Run
--   3. Xong — báo lại cho Claude Code để cấu hình js/config.js + chuyển
--      dữ liệu hiện có (nếu có) lên.
--
-- Thiết kế:
--   · hubs..words  = kho từ vựng DÙNG CHUNG — ai có link (URL+anon key)
--     cũng đọc/sửa được, không cần đăng nhập (đúng như comment gốc
--     trong config.js: "mọi người vào cùng link đều thấy chung kho").
--   · word_progress / block_progress = tiến trình học RIÊNG từng người —
--     chỉ đọc/sửa được đúng của mình (khoá theo auth.uid()), CẦN đăng
--     nhập (magic link) mới lưu lên đây; chưa đăng nhập thì app tự giữ
--     tiến trình tạm trong máy (xem js/db.js).
--   · id ở mọi bảng là TEXT (không phải uuid) — để nhận được id do máy
--     bạn tự sinh lúc chuyển dữ liệu cũ lên (di trú), đồng thời vẫn tự
--     sinh uuid dạng chữ nếu bạn tạo mới thẳng trên Supabase.
-- ══════════════════════════════════════════════════════════════════

-- ---------- KHO TỪ VỰNG (DÙNG CHUNG) ----------
create table if not exists hubs (
  id text primary key default gen_random_uuid()::text,
  code text,
  name text not null,
  sort integer default 0
);

create table if not exists notebooks (
  id text primary key default gen_random_uuid()::text,
  hub_id text not null references hubs(id) on delete cascade,
  name text not null,
  icon text,
  sort integer default 0
);

create table if not exists sections (
  id text primary key default gen_random_uuid()::text,
  notebook_id text not null references notebooks(id) on delete cascade,
  name text not null,
  sort integer default 0
);

create table if not exists pages (
  id text primary key default gen_random_uuid()::text,
  section_id text not null references sections(id) on delete cascade,
  name text not null,
  sort integer default 0
);

create table if not exists batches (
  id text primary key default gen_random_uuid()::text,
  page_id text not null references pages(id) on delete cascade,
  name text not null,
  sort integer default 0,
  created_at bigint
);

create table if not exists blocks (
  id text primary key default gen_random_uuid()::text,
  batch_id text not null references batches(id) on delete cascade,
  name text not null,
  global_index integer,
  sort integer default 0,
  context_passage text default '',                    -- bài đọc đang dùng (1 bài duy nhất)
  context_passage_candidates jsonb default '[]'::jsonb -- tối đa 3 bài Claude viết sẵn để chọn thử, chưa dùng luôn
);

create table if not exists words (
  id text primary key default gen_random_uuid()::text,
  block_id text not null references blocks(id) on delete cascade,
  sort integer default 0,
  term text not null,
  level text default '',
  pos text default '',
  ipa text default '',
  def_en text default '',
  meaning_vi text default ''
);

-- ---------- TIẾN TRÌNH HỌC (RIÊNG TỪNG NGƯỜI) ----------
create table if not exists word_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null references words(id) on delete cascade,
  attempts integer default 0,
  correct integer default 0,
  mastered boolean default false,
  familiarity integer default 1,
  last_reviewed_at bigint,
  primary key (user_id, word_id)
);

create table if not exists block_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  block_id text not null references blocks(id) on delete cascade,
  best_score integer default 0,
  passed boolean default false,       -- đạt Phiếu đầy đủ/Từng câu (đẩy chu kỳ ôn Tony Buzan)
  meaning_passed boolean default false, -- đạt thẻ Nghĩa (KHÔNG đẩy chu kỳ ôn, chỉ tính "Done")
  meaning_best integer default 0,
  cycle integer default 0,
  next_review_at bigint,
  last_reviewed_at bigint,
  last_exam_at bigint,
  review_history jsonb default '[]'::jsonb,  -- [{step, at}] mỗi lần thật sự đẩy chu kỳ (để tab Tiến trình khoe đúng ngày giờ đã ôn lần 1, lần 2...)
  primary key (user_id, block_id)
);

-- ---------- NHẬT KÝ HỌC THEO NGÀY (màn Journey) ----------
create table if not exists daily_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,             -- "YYYY-MM-DD" theo giờ máy người học
  learned integer default 0,      -- số từ đạt ≥ 80% ở 1 trong 3 thẻ bài tập hôm đó
  primary key (user_id, date)
);

-- ---------- HỒ SƠ NGƯỜI DÙNG (đăng nhập Cloud) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_emoji text
);

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════
alter table hubs            enable row level security;
alter table notebooks       enable row level security;
alter table sections        enable row level security;
alter table pages           enable row level security;
alter table batches         enable row level security;
alter table blocks          enable row level security;
alter table words           enable row level security;
alter table word_progress   enable row level security;
alter table block_progress  enable row level security;
alter table daily_log       enable row level security;
alter table profiles        enable row level security;

-- Kho từ vựng: mở cho cả khách (anon) lẫn người đã đăng nhập —
-- ai có URL + anon key của bạn cũng đọc/sửa chung 1 kho.
do $$
declare t text;
begin
  foreach t in array array['hubs','notebooks','sections','pages','batches','blocks','words']
  loop
    execute format('drop policy if exists "shared_all" on %I;', t);
    execute format(
      'create policy "shared_all" on %I for all to anon, authenticated using (true) with check (true);', t
    );
  end loop;
end $$;

-- Tiến trình học: chỉ đúng chủ mới đọc/ghi được của mình.
drop policy if exists "own_progress" on word_progress;
create policy "own_progress" on word_progress
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_progress" on block_progress;
create policy "own_progress" on block_progress
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_progress" on daily_log;
create policy "own_progress" on daily_log
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Hồ sơ: ai cũng xem được tên hiển thị (vd để show trong danh sách),
-- nhưng chỉ tự sửa được hồ sơ của chính mình.
drop policy if exists "read_all_profiles" on profiles;
create policy "read_all_profiles" on profiles for select to anon, authenticated using (true);
drop policy if exists "own_profile_write" on profiles;
create policy "own_profile_write" on profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "own_profile_update" on profiles;
create policy "own_profile_update" on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ══════════════════════════════════════════════════════════════════
-- CHỈ MỤC — cho nhanh khi bảng words/blocks lớn (9000+ dòng)
-- ══════════════════════════════════════════════════════════════════
create index if not exists idx_notebooks_hub    on notebooks(hub_id);
create index if not exists idx_sections_nb      on sections(notebook_id);
create index if not exists idx_pages_section    on pages(section_id);
create index if not exists idx_batches_page     on batches(page_id);
create index if not exists idx_blocks_batch     on blocks(batch_id);
create index if not exists idx_words_block      on words(block_id);
create index if not exists idx_wp_word          on word_progress(word_id);
create index if not exists idx_bp_block         on block_progress(block_id);
