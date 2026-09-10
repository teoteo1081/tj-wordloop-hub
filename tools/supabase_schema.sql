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
  sort integer default 0,
  parent_notebook_id text references notebooks(id) on delete set null   -- Notebook mẹ (thư mục) — NULL = ở cấp gốc. "on delete set null" (KHÔNG cascade): xoá Notebook mẹ chỉ đưa Notebook con ra cấp gốc, không xoá theo.
);
-- Project cũ đã tạo bảng notebooks từ trước (chưa có cột này) -> thêm vào,
-- không phá dữ liệu đã có (mọi Notebook cũ tự nhận NULL = vẫn ở cấp gốc).
alter table notebooks add column if not exists parent_notebook_id text references notebooks(id) on delete set null;
create index if not exists idx_notebooks_parent on notebooks(parent_notebook_id);

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
  meaning_vi text default '',
  freq text default ''   -- "common" (thông dụng) | "uncommon" (ít thông dụng) | "" (chưa chấm) — AI tự điền, xem Context.extractVocab/enrichWords
);
-- Project cũ đã tạo bảng words từ trước (chưa có cột freq) -> thêm cột này
-- vào, KHÔNG phá dữ liệu đã có (mọi dòng cũ tự nhận default '').
alter table words add column if not exists freq text default '';

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
-- "CẬP NHẬT LẦN CUỐI" — tự ghi nhận thời điểm sửa gần nhất của words/
-- blocks, BẤT KỂ sửa từ đâu (web UI, tools/import_vocab.py, hay sửa tay
-- trong Supabase Table Editor) — vì trigger nằm ở tầng database, không
-- phải tầng app, nên không sợ sót nguồn nào. Dùng để hiện dòng "Data cập
-- nhật lần cuối" ở màn Journey (xem DB.getVocabLastUpdated trong db.js).
-- ══════════════════════════════════════════════════════════════════
alter table words  add column if not exists updated_at timestamptz not null default now();
alter table blocks add column if not exists updated_at timestamptz not null default now();

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_words_updated_at on words;
create trigger trg_words_updated_at before insert or update on words
  for each row execute function set_updated_at();

drop trigger if exists trg_blocks_updated_at on blocks;
create trigger trg_blocks_updated_at before insert or update on blocks
  for each row execute function set_updated_at();

create index if not exists idx_words_updated_at  on words(updated_at);
create index if not exists idx_blocks_updated_at on blocks(updated_at);

-- ══════════════════════════════════════════════════════════════════
-- SHARE / ẨN-HIỆN NOTEBOOK THEO USER (2026-09-11, Mức A — CHỈ ẩn/hiện
-- giao diện, KHÔNG PHẢI bảo mật database thật, xem ghi chú dài trong
-- js/app.js gần Share.* — RLS bảng notebooks/blocks/... VẪN mở chung như
-- cũ, ai gọi thẳng Supabase API vẫn đọc được hết. Muốn chặn THẬT ở tầng
-- database (Mức B) thì phải làm lại toàn bộ tầng xác thực + RLS, xem
-- memory "project_tjhub_wordloop" — không làm trong đợt này).
--   · notebooks.visibility = 'everyone' (mặc định, y hệt trước giờ) |
--     'restricted' (chỉ Admin + user có mặt trong notebook_access mới
--     THẤY Notebook đó, kể cả Notebook con lồng bên trong — xem
--     App.notebookVisibleTo trong app.js đi ngược parent_notebook_id).
--   · notebook_access: 1 dòng = 1 user được share 1 Notebook, kèm role
--     ('view' = chỉ xem/học, không paste/sửa/xoá gì trong Notebook đó;
--     'edit' = toàn quyền y hệt mặc định trước giờ).
-- ══════════════════════════════════════════════════════════════════
alter table notebooks add column if not exists visibility text not null default 'everyone';

create table if not exists notebook_access (
  notebook_id text not null references notebooks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'view',   -- 'view' | 'edit'
  created_at timestamptz not null default now(),
  primary key (notebook_id, user_id)
);
alter table notebook_access enable row level security;
-- Đọc được cả bảng (kể cả anon) để CLIENT tự lọc Notebook nào ẩn/hiện —
-- ghi thì mọi role đều mở (giống "shared_all" ở trên, khớp mức tin tưởng
-- chung của app) vì đây chỉ là bảng cấu hình HIỂN THỊ, không phải nơi
-- chứa dữ liệu học thật.
drop policy if exists "shared_all" on notebook_access;
create policy "shared_all" on notebook_access for all to anon, authenticated using (true) with check (true);
create index if not exists idx_notebook_access_user on notebook_access(user_id);

-- ══════════════════════════════════════════════════════════════════
-- GIỚI HẠN AI — user THƯỜNG chỉ được nhờ Gemini viết bài đọc cho tối đa
-- 3 Block KHÁC NHAU mỗi ngày (Admin không giới hạn) — chấm ở
-- supabase/functions/gemini-proxy/index.ts (checkQuota/recordUsage), CHỈ
-- function đó (service role, tự bơm sẵn, không cần đặt secret) đọc/ghi
-- được bảng này — cố tình KHÔNG cấp policy nào cho anon/authenticated, để
-- không ai tự xoá lịch sử dùng của mình qua console trình duyệt để lách.
-- ══════════════════════════════════════════════════════════════════
create table if not exists ai_usage_daily (
  user_id text not null,
  block_id text not null references blocks(id) on delete cascade,
  date_key text not null,          -- "YYYY-MM-DD" theo giờ UTC của server
  provider text,
  created_at timestamptz not null default now(),
  primary key (user_id, block_id, date_key)
);
alter table ai_usage_daily enable row level security;
create index if not exists idx_ai_usage_daily_lookup on ai_usage_daily(user_id, date_key);

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
