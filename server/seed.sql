-- School for testing
INSERT INTO schools (name) VALUES ('Harmony Science Academy') ON CONFLICT DO NOTHING;

-- Math subject + topics + subtopics
INSERT INTO subjects (name) VALUES ('Math') ON CONFLICT (name) DO NOTHING;

INSERT INTO topics (subject_id, name) VALUES
  (1, 'Arithmetic'),
  (1, 'Fractions'),
  (1, 'Decimals'),
  (1, 'Percentages'),
  (1, 'Algebra Basics'),
  (1, 'Geometry Basics');

-- Arithmetic subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (1, 'Addition and Subtraction'),
  (1, 'Multiplication'),
  (1, 'Division'),
  (1, 'Order of Operations'),
  (1, 'Word Problems - Arithmetic');

-- Fractions subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (2, 'Adding Fractions'),
  (2, 'Subtracting Fractions'),
  (2, 'Multiplying Fractions'),
  (2, 'Dividing Fractions'),
  (2, 'Mixed Numbers');

-- Decimals subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (3, 'Decimal Addition and Subtraction'),
  (3, 'Decimal Multiplication'),
  (3, 'Converting Decimals to Fractions');

-- Percentages subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (4, 'Finding Percentages'),
  (4, 'Percent Increase and Decrease'),
  (4, 'Percent Word Problems');

-- Algebra subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (5, 'Variables and Expressions'),
  (5, 'Solving One-Step Equations'),
  (5, 'Solving Two-Step Equations');

-- Geometry subtopics
INSERT INTO subtopics (topic_id, name) VALUES
  (6, 'Area and Perimeter'),
  (6, 'Volume'),
  (6, 'Angles');

-- Shop items (10 cosmetic items for Phase 1)
INSERT INTO items (name, type, category, cost_coins, rarity, sprite_key) VALUES
  ('Blue Wizard Hat', 'cosmetic', 'hat', 50, 'common', 'hat_blue_wizard'),
  ('Red Cape', 'cosmetic', 'outfit', 100, 'common', 'outfit_red_cape'),
  ('Green Hood', 'cosmetic', 'hat', 75, 'common', 'hat_green_hood'),
  ('Gold Armor', 'cosmetic', 'outfit', 500, 'rare', 'outfit_gold_armor'),
  ('Shadow Cloak', 'cosmetic', 'outfit', 300, 'uncommon', 'outfit_shadow_cloak'),
  ('Crystal Crown', 'cosmetic', 'hat', 1000, 'epic', 'hat_crystal_crown'),
  ('Flame Boots', 'cosmetic', 'accessory', 200, 'uncommon', 'acc_flame_boots'),
  ('Pixel Cat', 'cosmetic', 'pet', 400, 'rare', 'pet_pixel_cat'),
  ('Dragon Egg', 'cosmetic', 'pet', 2000, 'epic', 'pet_dragon_egg'),
  ('Starter Pack', 'cosmetic', 'outfit', 25, 'common', 'outfit_starter');
