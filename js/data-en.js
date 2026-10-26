var PS = globalThis.PS || (globalThis.PS = {});
// English player-facing text for data.js, keyed like PS.DATA; js/i18n.js swaps it in when the language is English.
(function () {
  'use strict';
  PS.DATA_EN = {
    colors: {
      fire: { name: 'Fire', gen: 'fire', desc: 'Direct damage: 6. Empower: +3 damage per step.' },
      water: { name: 'Water', gen: 'water', desc: 'Shield: 6. Absorbs damage and burns off after the enemy attacks. Empower: +3 shield.' },
      life: { name: 'Life', gen: 'life', desc: 'Heals 4 HP. Empower: +2 HP.' },
      poison: { name: 'Poison', gen: 'poison', desc: 'Charge: 2 damage per turn for 4 turns. Ignores enemy shield. Empower: +1 damage per turn.' },
      lightning: { name: 'Lightning', gen: 'lightning', desc: 'Damage: 4 and the enemy acts 1 turn later (2 at combo ×2 or more). Empower: +2 damage.' },
      ice: { name: 'Ice', gen: 'ice', desc: 'Freezes the enemy for 2 turns (3 at combo ×2+): its timer stops, poison keeps ticking. Frozen enemies take +50% damage. Empower: +1 turn.' },
      dark: { name: 'Dark', gen: 'dark', desc: 'Damage: 12, and 3 damage to you that ignores shield. Empower: +4 damage.' },
      mirror: { name: 'Mirror', gen: 'mirror', desc: 'Repeats the effect of the last closed color at the current combo. If nothing was closed yet — 4 shield.' }
    },
    junk: {
      stone: { name: 'Stone', desc: 'Goes only onto stone or into an empty tube. Closing a neighbouring tube shatters its stones. No effect, but combo grows.' },
      slime: { name: 'Slime', desc: 'Goes only onto slime or into an empty tube. Closing: 3 shield (not boosted by combo).' }
    },
    potions: {
      undo: { name: 'Undo', desc: 'Rewinds the whole last turn: field, queue, combo, HP, shield, enemy, poison and timers.' },
      heal: { name: 'Healing', desc: 'Heals 25% of max HP.' },
      flask: { name: 'Empty Flask', desc: '+1 empty tube until the end of the fight.' },
      solvent: { name: 'Solvent', desc: 'Removes the top layer of the chosen tube (color or junk).' },
      shake: { name: 'Shake', desc: 'Shuffles the layers of the chosen tube.' },
      sleep: { name: 'Sleep Potion', desc: 'The enemy acts 3 turns later.' },
      firebomb: { name: 'Fire Bomb', desc: 'Damage = 3 × your current fire closing damage (no combo).' },
      combo: { name: 'Combo Elixir', desc: 'The next closing starts at combo ×2, then combo grows as usual.' }
    },
    mods: {
      tough: { name: 'Tough Alchemist', desc: '+10 max HP and +10 HP.' },
      apron: { name: 'Leather Apron', desc: '−10% damage from enemy attacks.' },
      caustic: { name: 'Caustic Mix', desc: '+2 damage to fire, lightning and dark.' },
      bubble: { name: 'Bubble', desc: '+6 shield at the start of every fight.' },
      prep: { name: 'Head Start', desc: '6 damage to the enemy at the start of every fight.' },
      thorns: { name: 'Thorns', desc: 'The enemy takes 3 damage every time it attacks.' },
      leech: { name: 'Bloodsucker', desc: '10% of damage dealt heals you (rounded up).' },
      combo_master: { name: 'Combo Master', desc: '+0.25 to combo multipliers after the first (×1.75 → ×2.25 → ×3.25).' },
      potion_pick: { name: 'Potion of Choice', desc: 'Pick 1 of 3 potions. Not offered when the belt is full.' }
    },
    finds: {
      new_color: { name: 'New Essence', desc: 'Add an unlocked color you don\'t have yet. At 5 colors — replace one (its empowers are lost).' },
      boost_color: { name: 'Empower Essence', desc: '+1 empower step to a color in your deck (up to 3 per color, not mirror).' },
      special_tube: { name: 'Special Tube', desc: 'A random unlocked special tube in an empty slot; if none is empty — replace one.' },
      extra_slot: { name: 'Extra Slot', desc: '+1 empty tube in every fight (up to 5 slots).' },
      filter: { name: 'Filter', desc: 'Half as many stones and spores from enemies and junk in the queue.' }
    },
    tubes: {
      plain: { name: 'Plain Tube', desc: 'A regular tube with 4 layers.' },
      amp: { name: 'Amplifier', desc: 'Closing effect ×2.' },
      catalyst: { name: 'Catalyst', desc: 'Closing in it doesn\'t use a turn.' },
      sieve: { name: 'Sieve', desc: 'Stone and slime poured into it vanish; that pour doesn\'t use a turn.' },
      bomb: { name: 'Bomb', desc: 'On closing, knocks the top layer off two neighbouring tubes (neighbours are highlighted).' },
      big: { name: 'Big Tube', desc: '6 layers instead of 4, effect ×1.5.' },
      vial: { name: 'Vial', desc: '2 layers of any colors mixed, never closes.' }
    },
    rarity: {
      common: { name: 'Common' },
      rare: { name: 'Rare' },
      legendary: { name: 'Legendary' }
    },
    relics: {
      hot_crucible: { name: 'Hot Crucible', desc: 'Fire +4 damage.' },
      hourglass: { name: 'Hourglass', desc: 'The enemy\'s first action in each fight comes 2 turns later.' },
      lucky_clover: { name: 'Lucky Clover', desc: '15% chance a turn isn\'t spent.' },
      golden_stopper: { name: 'Golden Stopper', desc: '+25% coins this run.' },
      alchemist_heart: { name: 'Alchemist\'s Heart', desc: 'Closing at ×2 or more heals 3 HP.' },
      stone_heart: { name: 'Stone Heart', desc: 'Every stone shattered or collected deals 4 damage to the enemy.' },
      sponge: { name: 'Sponge', desc: 'A full tube of slime gives 10 shield instead of 3.' },
      blood_retort: { name: 'Blood Retort', desc: 'Dark doesn\'t hurt you — it heals 2 HP.' },
      storm_rod: { name: 'Storm Rod', desc: 'Lightning delays the enemy by 2 turns (3 at combo ×2+).' },
      trap: { name: 'Trap', desc: 'Every time the enemy spoils the field (stones, spores, stealing, freezing, swapping), it takes 8 damage.' },
      mirror_shield: { name: 'Mirror Shield', desc: 'Shield left after an enemy attack hits it back for the same amount.' },
      crystal_ward: { name: 'Crystal Ward', desc: 'Only half of your shield burns off after an enemy attack.' },
      frost_crown: { name: 'Frost Crown', desc: 'Frozen enemies take +100% damage instead of +50%.' },
      poison_ivy: { name: 'Poison Ivy', desc: 'Poison charges last 8 turns instead of 4.' },
      void_lens: { name: 'Void Lens', desc: 'Mirror repeats the effect twice.' },
      bandolier: { name: 'Bandolier', desc: 'A random potion at the start of each fight, if the belt has room.' },
      cascade_chute: { name: 'Cascade Chute', desc: 'A cascade closing raises combo by 2 steps.' },
      patient_mage: { name: 'Patient Mage', desc: 'Combo resets only after 2 turns in a row without closing.' },
      philosopher_stone: { name: 'Philosopher\'s Stone', desc: 'After each enemy action your next pour is free.' },
      great_cauldron: { name: 'Great Cauldron', desc: 'Closing at ×3 triggers twice.' },
      phoenix_feather: { name: 'Phoenix Feather', desc: 'Once per run, on death — revive with 30% HP.' }
    },
    lab: {
      vitality: { name: 'Sturdy Flask', desc: '+5 max HP per level.' },
      essence_fire: { name: 'Fire Essence', desc: 'Fire +1 per level.' },
      essence_water: { name: 'Water Essence', desc: 'Water +1 per level.' },
      essence_life: { name: 'Life Essence', desc: 'Life +1 per level.' },
      start_shield: { name: 'Shield Stopper', desc: '+3 shield at the start of every fight per level.' },
      belt: { name: 'Potion Belt', desc: 'Level 1: +1 random potion at the start. Level 2: +1 belt slot.' },
      intuition: { name: 'Intuition', desc: '4 choices instead of 3.' },
      second_wind: { name: 'Second Wind', desc: '+5% healing after a stage per level.' },
      mastery: { name: 'Alchemy Mastery', desc: '+5% to all color effects per level.' },
      slot: { name: 'Extra Slot', desc: '+1 empty tube per level.' },
      thrift: { name: 'Thrift', desc: '+10% coins per level.' }
    },
    boosters: {
      booster_potion: { name: 'Potion of Choice', desc: 'Any unlocked potion into your belt.' },
      booster_flask: { name: 'Spare Tube', desc: '+1 empty tube in every fight.' },
      booster_vitality: { name: 'Fortitude', desc: '+20 max HP for this run.' },
      booster_first_strike: { name: 'First Strike', desc: '×2 damage from all effects on the first stage.' }
    },
    enemies: {
      slime: { name: 'Slime', desc: 'Hits for 5 every 3 turns.' },
      gremlin: { name: 'Gremlin Thief', desc: 'Hits for 4, steals layers.' },
      beetle: { name: 'Spiky Beetle', desc: 'Raises a 6 shield, hits for 6.' },
      golem: { name: 'Stone Golem', desc: 'Drops stones, hits for 9.' },
      boulder: { name: 'Rolling Boulder', desc: 'Rare but heavy hit: 14.' },
      mole: { name: 'Rock Mole', desc: 'Steals layers, hits for 6.' },
      frost_spirit: { name: 'Rime Spirit', desc: 'Freezes tubes for 3 turns, hits for 5.' },
      ice_wolf: { name: 'Ice Wolf', desc: 'Quick bites: 4 every 2 turns.' },
      snow_golem: { name: 'Snow Golem', desc: 'Stones, a 6 shield and a hit for 7.' },
      mycelium: { name: 'Mycelium', desc: 'Turns queue layers into slime, hits for 6.' },
      toad_shaman: { name: 'Toadstool Shaman', desc: 'Shield 8, doubles its next attack, hits for 7.' },
      rot_slime: { name: 'Rot Slime', desc: 'Hits for 5, rots the queue.' },
      imp: { name: 'Fire Imp', desc: 'Hits for 6 every 2 turns.' },
      lava_golem: { name: 'Lava Golem', desc: 'Drops 3 stones, hits for 10.' },
      ash_trickster: { name: 'Ash Trickster', desc: 'Swaps colors around, hits for 8.' }
    },
    bosses: {
      slime_king: { name: 'Slime King', desc: 'Hits and rots the queue. On the second island it shields too.' },
      ancient_golem: { name: 'Ancient Golem', desc: 'Stones, heavy hits and a 12 shield.' },
      ice_queen: { name: 'Ice Queen', desc: 'Freezes tubes and hides behind a shield.' },
      mycelium_mother: { name: 'Mycelium Mother', desc: 'Rots the queue and heals.' },
      lava_serpent: { name: 'Lava Serpent', desc: 'Burns, drops stones, powers up its hit.' },
      trickster: { name: 'Trickster Alchemist', desc: 'Final boss: mixes up colors, shields, powers up its hit.' }
    },
    worlds: {
      meadows: { desc: 'No twist — the tutorial.' },
      crags: { desc: 'Every 8 turns a stone falls onto the field.' },
      frost: { desc: 'At the start of a fight one random tube is frozen for 3 turns.' },
      gloomwood: { desc: '10% of queue layers are slime.' },
      ashlands: { desc: 'Enemy attacks set you on fire: 1 damage per turn for 2 turns, ignores shield.' }
    },
    unlockNotes: {
      1: 'Tutorial: fire, water, life',
      2: 'New color: poison',
      3: 'Special tubes: Amplifier and Sieve',
      4: 'New color: lightning',
      5: 'Catalyst and Extra Slot',
      6: 'New color: ice',
      7: 'Bomb and Fire Bomb',
      8: 'New color: dark',
      9: 'New color: mirror',
      10: 'Big Tube and Vial'
    },
    quests: {
      close_color: 'Close {n} {color} tubes',
      kill: 'Defeat {n} enemies',
      boss_reach: 'Reach a boss fight',
      combo3: 'Hit a ×3 combo',
      close_junk: 'Close {n} junk tubes',
      potions: 'Use {n} potions',
      stages: 'Clear {n} stages today',
      lab_spend: 'Spend {n} coins in the Lab'
    },
    products: {
      gems_80: { name: 'Handful of Gems', price: '$0.99' },
      gems_450: { name: 'Pouch of Gems', price: '$4.99' },
      gems_1000: { name: 'Chest of Gems', price: '$9.99' },
      gems_2200: { name: 'Treasury', price: '$19.99' },
      no_ads: { name: 'No Ads', price: '$3.99', desc: 'Removes ads between runs forever. Ads for rewards stay optional.' },
      starter: { name: 'Starter Pack', price: '$1.99', desc: '150 💎 and 600 🪙. One-time, 48 hours after island 2.' },
      seal: { name: 'Alchemist\'s Seal', price: '$4.99', desc: '30 days: +50% coins, daily reward ×2, revive without ads, no ads between runs.' }
    },
    coinPacks: {
      coins_s: { name: 'Small Stack' },
      coins_m: { name: 'Medium Stack' },
      coins_l: { name: 'Big Stack' }
    }
  };
})();
