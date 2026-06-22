-- Seed: product slang mappings exposed by the 2026-06-20 benchmark run
-- These are Gujlish/Hinglish colloquial product names that don't fuzzy-match
-- their catalog equivalents (semantic gap, not a spelling gap).

-- ============================================================
-- TEXTILES — product slang
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
-- Dupatta variants
('chunni', 'chunni', 'Dupatta', 'product', 'textiles', 'gujlish'),
('chunari', 'chunari', 'Dupatta', 'product', 'textiles', 'gujlish'),
('odhni', 'odhni', 'Dupatta', 'product', 'textiles', 'gujlish'),
('ઓઢણી', 'ઓઢણી', 'Dupatta', 'product', 'textiles', 'gujarati'),
('odhanu', 'odhanu', 'Dupatta', 'product', 'textiles', 'gujlish'),
-- Cotton Fabric variants
('kapdu', 'kapdu', 'Cotton Fabric', 'product', 'textiles', 'gujlish'),
('kapda', 'kapda', 'Cotton Fabric', 'product', 'textiles', 'hinglish'),
('કપડું', 'કપડું', 'Cotton Fabric', 'product', 'textiles', 'gujarati'),
('suti kapdu', 'suti kapdu', 'Cotton Fabric', 'product', 'textiles', 'gujlish'),
-- Embroidery Thread variants
('thraed', 'thraed', 'Embroidery Thread', 'product', 'textiles', 'gujlish'),
('thread', 'thread', 'Embroidery Thread', 'product', 'textiles', 'gujlish'),
('resham dhago', 'resham dhago', 'Embroidery Thread', 'product', 'textiles', 'gujlish'),
('bharat kaam dhago', 'bharat kaam dhago', 'Embroidery Thread', 'product', 'textiles', 'gujlish'),
-- Saree variants
('sadi', 'sadi', 'Saree', 'product', 'textiles', 'gujlish'),
('સાડી', 'સાડી', 'Saree', 'product', 'textiles', 'gujarati'),
('saadi', 'saadi', 'Saree', 'product', 'textiles', 'gujlish'),
-- Kurta/suit piece
('kurto', 'kurto', 'Kurta Piece', 'product', 'textiles', 'gujlish'),
('કુર્તો', 'કુર્તો', 'Kurta Piece', 'product', 'textiles', 'gujarati'),
('suit piece', 'suit piece', 'Suit Piece', 'product', 'textiles', 'gujlish'),
('dress material', 'dress material', 'Dress Material', 'product', 'textiles', 'gujlish'),
-- Lining
('astar', 'astar', 'Lining Fabric', 'product', 'textiles', 'gujlish'),
('અસ્તર', 'અસ્તર', 'Lining Fabric', 'product', 'textiles', 'gujarati'),
-- Embroidery work
('bharat kaam', 'bharat kaam', 'Embroidery Work', 'product', 'textiles', 'gujlish'),
('ભરતકામ', 'ભરતકામ', 'Embroidery Work', 'product', 'textiles', 'gujarati'),
('zari', 'zari', 'Zari Work', 'product', 'textiles', 'gujlish'),
('ઝરી', 'ઝરી', 'Zari Work', 'product', 'textiles', 'gujarati'),
-- Misc textile products
('lace', 'lace', 'Lace', 'product', 'textiles', 'gujlish'),
('border', 'border', 'Border Lace', 'product', 'textiles', 'gujlish'),
('patti', 'patti', 'Tape/Ribbon', 'product', 'textiles', 'gujlish');

-- ============================================================
-- DIAMOND — product slang
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('stone', 'stone', 'Diamond Stone', 'product', 'diamond', 'gujlish'),
('pathar', 'pathar', 'Diamond Stone', 'product', 'diamond', 'gujlish'),
('પથ્થર', 'પથ્થર', 'Diamond Stone', 'product', 'diamond', 'gujarati'),
('single cut', 'single cut', 'Single Cut Diamond', 'product', 'diamond', 'gujlish'),
('star', 'star', 'Star Cut Diamond', 'product', 'diamond', 'gujlish'),
('nayka', 'nayka', 'Polished Diamond', 'product', 'diamond', 'gujlish');

-- ============================================================
-- AUTO PARTS — product slang
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('ring piston', 'ring piston', 'Piston Ring', 'product', 'auto_parts', 'gujlish'),
('hub', 'hub', 'Wheel Hub', 'product', 'auto_parts', 'gujlish'),
('liner', 'liner', 'Cylinder Liner', 'product', 'auto_parts', 'gujlish'),
('shocker', 'shocker', 'Shock Absorber', 'product', 'auto_parts', 'gujlish'),
('wiper', 'wiper', 'Wiper Blade', 'product', 'auto_parts', 'gujlish');

-- ============================================================
-- PLASTICS — product slang
-- ============================================================
INSERT INTO industry_dictionary (term, term_normalized, canonical, category, industry_segment, language) VALUES
('dabbo', 'dabbo', 'Container/Box', 'product', 'plastics', 'gujlish'),
('ડબ્બો', 'ડબ્બો', 'Container/Box', 'product', 'plastics', 'gujarati'),
('dabba', 'dabba', 'Container/Box', 'product', 'plastics', 'hinglish'),
('bottle', 'bottle', 'Plastic Bottle', 'product', 'plastics', 'gujlish'),
('jar', 'jar', 'Plastic Jar', 'product', 'plastics', 'gujlish'),
('bucket', 'bucket', 'Plastic Bucket', 'product', 'plastics', 'gujlish'),
('balti', 'balti', 'Plastic Bucket', 'product', 'plastics', 'gujlish');
