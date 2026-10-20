import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateBaleteBoundaries } from "../src/lib/barangay-geofence.ts";
import { reportSubmission } from "../src/lib/report-submission.ts";
import { classificationText, UNCERTAIN_TEXT } from "../src/lib/waste-classification.ts";
import { learningResourceType, publicLearningUrl } from "../src/lib/learning-resource.ts";

const boundaries = validateBaleteBoundaries(JSON.parse(readFileSync(new URL("../public/geojson/balete_barangays.json", import.meta.url))));
const pin = name => {
  const [longitude, latitude] = boundaries.features.find(item => item.properties.name === name).properties.labelPoint;
  return { latitude, longitude };
};
const body = { requestId: "1ed8f083-0b44-4c26-bfd7-d53f6cbec171", type: "Illegal Dumping", description: "Discarded bags near the road", ...pin("Sala"), attachments: [] };
const profile = { role: "Resident", barangay: "Sala", name: "Resident" };

test("residents can report only inside their own registered barangay, even with a forged address", () => {
  assert.equal(reportSubmission({ ...body, location: "Malabanan" }, profile, boundaries, "demo").location, "Sala");
  assert.throws(() => reportSubmission({ ...body, ...pin("Malabanan"), location: "Sala" }, profile, boundaries, "demo"), /registered barangay/);
  for (const feature of boundaries.features) {
    const barangay = feature.properties.name;
    assert.equal(reportSubmission({ ...body, ...pin(barangay) }, { ...profile, barangay }, boundaries, "demo").location, barangay);
  }
  for (const gps of [{ latitude: 0, longitude: 0 }, { latitude: "14", longitude: 121 }, { latitude: 14.005, longitude: 121.06 }])
    assert.throws(() => reportSubmission({ ...body, ...gps }, profile, boundaries, "demo"));
  assert.throws(() => reportSubmission(body, { ...profile, role: "Semi-Admin" }, boundaries, "demo"));
});

test("photo and video evidence is validated together and legacy imageUrl still points at the first photo", () => {
  const attachments = [{ type: "video", url: "https://res.cloudinary.com/demo/video/upload/clip.mp4" },
    { type: "image", url: "https://res.cloudinary.com/demo/image/upload/photo.jpg" }];
  const result = reportSubmission({ ...body, attachments, status: "Resolved" }, profile, boundaries, "demo");
  assert.deepEqual(result.attachments, attachments);
  assert.equal(result.imageUrl, attachments[1].url);
  assert.equal(result.status, "Pending");
  for (const url of ["javascript:alert(1)", "https://example.org/photo.jpg", "https://res.cloudinary.com/other/image/upload/photo.jpg", "https://res.cloudinary.com/demo/video/upload/clip.mp4"]) {
    assert.throws(() => reportSubmission({ ...body, attachments: [{ type: "image", url }] }, profile, boundaries, "demo"));
  }
  assert.throws(() => reportSubmission({ ...body, attachments: Array(6).fill(attachments[0]) }, profile, boundaries, "demo"));
  assert.throws(() => reportSubmission({ ...body, description: "  " }, profile, boundaries, "demo"));
});

test("scanner identifies general subjects and keeps tentative objects without a confidence cutoff", () => {
  const result = { item: "Plastic bottle", type: "Recyclable", confidence: 95, steps: ["Empty and rinse", "Place in the recycling bin"] };
  assert.match(classificationText(JSON.stringify(result)), /TYPE: Recyclable/);
  for (const item of ["Person", "Dog", "Growing tree", "Building"]) {
    const text = classificationText(JSON.stringify({ ...result, item, type: "Not Waste", steps: ["A visible subject, not an item for disposal"] }));
    assert.match(text, new RegExp("ITEM: " + item));
    assert.match(text, /TYPE: Not Waste/);
  }
  assert.throws(() => classificationText("ITEM: Person\nTYPE: Special"));
  for (const invalid of [{ confidence: -1 }, { confidence: 101 }, { type: "Bogus" }, { steps: [] }, { item: "" }])
    assert.throws(() => classificationText(JSON.stringify({ ...result, ...invalid })));
  assert.match(classificationText(JSON.stringify({ ...result, confidence: 40 })), /CONFIDENCE: 40%/);
  assert.match(classificationText(JSON.stringify({ ...result, confidence: 1 })), /CONFIDENCE: 1%/);
  assert.equal(classificationText(JSON.stringify({ ...result, type: "Uncertain" })), UNCERTAIN_TEXT);
  assert.match(classificationText(JSON.stringify({ ...result, confidence: 0.95 })), /CONFIDENCE: 95%/);
  for (const item of ["Baby food jar", "Plastic bottle held by a person", "Man-made plastic container"]) assert.match(classificationText(JSON.stringify({ ...result, item })), /TYPE: Recyclable/);
});

test("signed PDF URLs, extensionless uploaded documents and article links keep usable source metadata", () => {
  const pdf = "https://example.org/guide.pdf?download=1&token=a%2Fb";
  assert.equal(publicLearningUrl(pdf), pdf);
  assert.equal(learningResourceType(pdf, "", "Article"), "document");
  assert.equal(learningResourceType("https://example.org/upload/123", "guide.pdf"), "document");
  assert.equal(learningResourceType("https://example.org/recycling", "", "Article"), "article");
  assert.equal(learningResourceType("https://res.cloudinary.com/demo/video/upload/clip", "", "Video"), "video");
  for (const url of ["data:application/pdf;base64,abc", "javascript:alert(1)", "/local-preview.pdf", "http://example.org/doc.pdf"])
    assert.throws(() => publicLearningUrl(url));
});
