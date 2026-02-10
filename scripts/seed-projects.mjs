import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "674rl5gi",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// Sample data for generating varied credits
const directors = [
  "Iris Kim",
  "Alex Chen",
  "Jordan Rivera",
  "Sam Nakamura",
  "Taylor Brooks",
  "Morgan Lee",
  "Casey Williams",
  "Riley Johnson",
];

const producers = [
  "Suzanne Zielinski",
  "Michael Torres",
  "Sarah Goldberg",
  "David Park",
  "Emma Wilson",
  "James Liu",
  "Olivia Martinez",
];

const agencies = [
  "Mad Ruk Entertainment Inc.",
  "Ogilvy",
  "Wieden+Kennedy",
  "BBDO",
  "DDB Worldwide",
  "Leo Burnett",
  "Droga5",
  "72andSunny",
  "Anomaly",
  "Mother",
];

const projectTitles = [
  "Summer Dreams",
  "Urban Pulse",
  "Neon Nights",
  "Golden Hour",
  "Silent Echo",
  "Chromatic",
  "Velocity",
  "Midnight Sun",
  "Paper Hearts",
  "Electric Blue",
  "Wanderlust",
  "Luminous",
  "Monochrome",
  "Cascade",
  "Ephemeral",
  "Solstice",
  "Paradigm",
  "Aperture",
  "Momentum",
  "Zenith",
  "Parallax",
  "Resonance",
  "Cipher",
  "Axiom",
  "Prism",
];

// Color variations for placeholder images
const colors = [
  "264653", "2a9d8f", "e9c46a", "f4a261", "e76f51",
  "023047", "ffb703", "fb8500", "8ecae6", "219ebc",
  "606c38", "283618", "fefae0", "dda15e", "bc6c25",
  "003049", "d62828", "f77f00", "fcbf49", "eae2b7",
  "0d1b2a", "1b263b", "415a77", "778da9", "e0e1dd",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomYear() {
  return 2020 + Math.floor(Math.random() * 5); // 2020-2024
}

function randomPriority() {
  return Math.floor(Math.random() * 10) + 1; // 1-10
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function createCaptionBlock(director, producer, agency) {
  return [
    {
      _type: "block",
      _key: Math.random().toString(36).substr(2, 9),
      style: "normal",
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: Math.random().toString(36).substr(2, 9),
          text: `Director: ${director}. Production: ${producer}. Agency: ${agency}.`,
          marks: [],
        },
      ],
    },
  ];
}

async function uploadImageFromUrl(url, filename) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const asset = await client.assets.upload("image", Buffer.from(buffer), {
    filename,
    contentType: "image/png",
  });
  return asset;
}

async function seedProjects() {
  console.log("Starting to seed 25 projects with images...\n");

  // First, upload placeholder images for all projects
  console.log("Uploading placeholder images...");

  const imageAssets = [];

  // Upload enough images for cover + media (up to 6 per project = 150 images max)
  // We'll create 75 images and reuse them
  const totalImages = 75;

  for (let i = 0; i < totalImages; i++) {
    const color = colors[i % colors.length];
    const width = 1920;
    const height = 1080;
    // Using placeholder.co for colored placeholder images
    const url = `https://placehold.co/${width}x${height}/${color}/ffffff/png?text=Project+${Math.floor(i / 3) + 1}+Image+${(i % 3) + 1}`;

    try {
      console.log(`Uploading image ${i + 1}/${totalImages}...`);
      const asset = await uploadImageFromUrl(url, `placeholder-${i + 1}.png`);
      imageAssets.push(asset);
    } catch (err) {
      console.error(`Failed to upload image ${i + 1}:`, err.message);
      // Try alternative placeholder service
      try {
        const altUrl = `https://picsum.photos/seed/${i + 1}/${width}/${height}`;
        const asset = await uploadImageFromUrl(altUrl, `placeholder-${i + 1}.jpg`);
        imageAssets.push(asset);
      } catch (altErr) {
        console.error(`Alternative also failed:`, altErr.message);
      }
    }
  }

  console.log(`\nUploaded ${imageAssets.length} images successfully.\n`);

  if (imageAssets.length === 0) {
    console.error("No images uploaded. Cannot proceed.");
    process.exit(1);
  }

  const transaction = client.transaction();

  for (let i = 0; i < 25; i++) {
    const title = projectTitles[i];
    const director = randomFrom(directors);
    const producer = randomFrom(producers);
    const agency = randomFrom(agencies);

    // Get images for this project (3 images per project from our pool)
    const projectImageStart = (i * 3) % imageAssets.length;
    const coverImageAsset = imageAssets[projectImageStart % imageAssets.length];

    // Create 3-5 media items
    const mediaCount = randomInt(3, 5);
    const media = [];

    for (let j = 0; j < mediaCount; j++) {
      const imgIndex = (projectImageStart + j) % imageAssets.length;
      const imgAsset = imageAssets[imgIndex];

      media.push({
        _type: "image",
        _key: Math.random().toString(36).substr(2, 9),
        asset: {
          _type: "reference",
          _ref: imgAsset._id,
        },
        hotspot: {
          x: 0.5,
          y: 0.5,
          height: 1,
          width: 1,
        },
      });
    }

    const project = {
      _id: `project-${slugify(title)}`,
      _type: "project",
      title,
      slug: {
        _type: "slug",
        current: slugify(title),
      },
      year: randomYear(),
      priority: randomPriority(),
      coverImage: {
        _type: "image",
        asset: {
          _type: "reference",
          _ref: coverImageAsset._id,
        },
        hotspot: {
          x: 0.5,
          y: 0.5,
          height: 1,
          width: 1,
        },
      },
      media,
      caption: createCaptionBlock(director, producer, agency),
    };

    transaction.createOrReplace(project);
    console.log(`Prepared: ${title} (${mediaCount} media items)`);
    console.log(`  Director: ${director}`);
    console.log(`  Production: ${producer}`);
    console.log(`  Agency: ${agency}\n`);
  }

  console.log("Committing transaction...");
  await transaction.commit();
  console.log("\nSuccessfully seeded 25 projects with images!");
}

seedProjects().catch((err) => {
  console.error("Error seeding projects:", err);
  process.exit(1);
});
