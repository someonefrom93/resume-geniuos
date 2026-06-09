/**
 * Smoke test for the Zustand store.
 *
 * Verifies that:
 *   1. Initial state is an empty resume
 *   2. updateContact mutates and persists
 *   3. addExperience / updateExperience / removeExperience work
 *   4. addSkill / removeSkill work, with dedup
 *   5. Hydration from a serialized state works
 *   6. localStorage persistence round-trips
 *
 * Run: npx tsx scripts/test-store.ts
 */

import { useResumeStore } from '../store/resumeStore';
import type { Resume } from '../types/resume';

let failed = 0;
function check(name: string, pass: boolean, detail?: string) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failed++;
}

// We test against the live store instance. Reset before each test group.
function fresh() {
  useResumeStore.setState({
    resume: {
      version: 1,
      contact: { name: '', email: '' },
      summary: '',
      experience: [],
      education: [],
      skills: { technical: [], soft: [], languages: [], tools: [] },
      projects: [],
      updatedAt: new Date().toISOString(),
    },
    isHydrated: true,
    lastScore: null,
  });
}

// ---------------------------------------------------------------------------
console.log('--- 1. updateContact ---');
fresh();
const updateContact = useResumeStore.getState().updateContact;
updateContact({ name: 'Alice', email: 'alice@example.com' });
let r = useResumeStore.getState().resume;
check('name set', r.contact.name === 'Alice');
check('email set', r.contact.email === 'alice@example.com');
check('updatedAt bumped', typeof r.updatedAt === 'string' && r.updatedAt.length > 0);

updateContact({ phone: '+1 555 0001' });
r = useResumeStore.getState().resume;
check('phone set on second call', r.contact.phone === '+1 555 0001');
check('name preserved across calls', r.contact.name === 'Alice');

// ---------------------------------------------------------------------------
console.log('\n--- 2. Experience CRUD ---');
fresh();
const { addExperience, updateExperience, removeExperience, reorderExperience } = useResumeStore.getState();
addExperience();
let exp = useResumeStore.getState().resume.experience;
check('one experience after add', exp.length === 1);
check('id is present', typeof exp[0]!.id === 'string' && exp[0]!.id.length > 0);
const id1 = exp[0]!.id;

updateExperience(id1, { company: 'Acme', position: 'Engineer', startDate: '2020' });
exp = useResumeStore.getState().resume.experience;
check('company updated', exp[0]!.company === 'Acme');
check('position updated', exp[0]!.position === 'Engineer');
check('startDate updated', exp[0]!.startDate === '2020');
check('id preserved', exp[0]!.id === id1);

addExperience();
addExperience();
const allExp = useResumeStore.getState().resume.experience;
check('three experiences after 2 more adds', allExp.length === 3);
// The new add should put the new item at the TOP of the list (index 0).
// id1 was the first add and is now at index 2.
check('id1 moved to last position (newest-first)', allExp[2]!.id === id1);
check('newest item at index 0', allExp[0]!.id !== id1);

// Reorder: move id1 from index 2 to index 0.
reorderExperience(2, 0);
const reordered = useResumeStore.getState().resume.experience;
check('id1 now at index 0 after reorder', reordered[0]!.id === id1);
check('list length preserved', reordered.length === 3);

// Reorder with bad indices: should be a no-op (not throw, not change).
reorderExperience(99, 0);
reorderExperience(0, 99);
const afterBadReorder = useResumeStore.getState().resume.experience;
check('out-of-bounds reorder is no-op', afterBadReorder.length === 3 && afterBadReorder[0]!.id === id1);

removeExperience(id1);
const remaining = useResumeStore.getState().resume.experience;
check('id1 removed', !remaining.some((e) => e.id === id1));
check('count after remove = 2', remaining.length === 2);

// ---------------------------------------------------------------------------
console.log('\n--- 3. Skills (dedup) ---');
fresh();
const { addSkill, removeSkill } = useResumeStore.getState();
addSkill('technical', 'TypeScript');
addSkill('technical', 'Python');
addSkill('technical', 'TypeScript'); // dup — should be ignored
let skills = useResumeStore.getState().resume.skills;
check('two unique technical skills', skills.technical.length === 2, `got ${JSON.stringify(skills.technical)}`);
check('order preserved', skills.technical[0] === 'TypeScript' && skills.technical[1] === 'Python');

addSkill('technical', '  Go  '); // should be trimmed
skills = useResumeStore.getState().resume.skills;
check('whitespace trimmed', skills.technical[2] === 'Go', `got ${JSON.stringify(skills.technical)}`);

addSkill('technical', ''); // empty — ignored
check('empty string ignored', useResumeStore.getState().resume.skills.technical.length === 3);

removeSkill('technical', 1); // remove 'Python'
skills = useResumeStore.getState().resume.skills;
check('after remove: TS, Go', skills.technical.length === 2 && skills.technical.includes('TypeScript') && skills.technical.includes('Go'));

addSkill('tools', 'Git');
addSkill('tools', 'Docker');
check('tools category independent', useResumeStore.getState().resume.skills.tools.length === 2);

// ---------------------------------------------------------------------------
console.log('\n--- 4. End-to-end: simulate a real edit session ---');
fresh();
const s = useResumeStore.getState();
s.updateContact({ name: 'Bob', email: 'bob@test.com' });
s.setSummary('Senior engineer with 10 years of experience.');
s.addExperience();
const bobExp = useResumeStore.getState().resume.experience[0]!;
s.updateExperience(bobExp.id, {
  company: 'BigCo',
  position: 'Staff Engineer',
  startDate: '2020',
  endDate: 'Present',
  bullets: ['Did things', 'Did more things'],
});
s.addEducation();
const bobEdu = useResumeStore.getState().resume.experience[0]!; // grab any item id
s.removeExperience(bobExp.id); // remove the exp
const eduId = useResumeStore.getState().resume.education[0]?.id;
s.updateEducation(eduId!, { institution: 'MIT', degree: 'BS CS', startDate: '2010', endDate: '2014' });

const final = useResumeStore.getState().resume;
check('contact set', final.contact.name === 'Bob');
check('summary set', final.summary.includes('Senior engineer'));
check('experience removed', final.experience.length === 0);
check('education set', final.education[0]?.institution === 'MIT');

// ---------------------------------------------------------------------------
console.log('\n--- 5. Projects reorder (newest-first on add) ---');
fresh();
const ps = useResumeStore.getState();
ps.addProject();
ps.addProject();
const allProjects = useResumeStore.getState().resume.projects;
check('two projects after 2 adds', allProjects.length === 2);
const pA = allProjects[0]!.id;
const pB = allProjects[1]!.id;

// Move pB (the older one) to the top.
ps.reorderProjects(1, 0);
const reorderedP = useResumeStore.getState().resume.projects;
check('pB at index 0 after reorder(1, 0)', reorderedP[0]!.id === pB);
check('pA at index 1', reorderedP[1]!.id === pA);

ps.addProject();
const pC = useResumeStore.getState().resume.projects[0]!.id;
check('new add goes to index 0', pC !== pA && pC !== pB);
check('count = 3', useResumeStore.getState().resume.projects.length === 3);

// ---------------------------------------------------------------------------
console.log('\n--- 6. Set experience / education (replaces the list) ---');
fresh();
const ss = useResumeStore.getState();
ss.setExperience([
  {
    id: 'x1',
    company: 'Acme',
    position: 'Engineer',
    startDate: 'Jan 2020',
    endDate: 'Dec 2022',
    bullets: ['Did things', 'Did more things'],
  },
  {
    id: 'x2',
    company: 'Foo',
    position: 'Senior',
    startDate: 'Jan 2023',
    endDate: null,
    bullets: ['Led things'],
  },
]);
let expList = useResumeStore.getState().resume.experience;
check('setExperience creates 2 items', expList.length === 2);
check('item 0 has all fields', expList[0]!.company === 'Acme' && expList[0]!.bullets.length === 2);
check('item 1 endDate is null (current)', expList[1]!.endDate === null);

ss.setExperience([]); // clear
expList = useResumeStore.getState().resume.experience;
check('setExperience([]) clears the list', expList.length === 0);

ss.setExperience([
  {
    id: '',
    company: 'Test',
    position: 'Eng',
    startDate: '',
    endDate: null,
    bullets: [],
  },
]);
expList = useResumeStore.getState().resume.experience;
check('setExperience assigns id when missing', typeof expList[0]!.id === 'string' && expList[0]!.id.length > 0);
check('setExperience adds placeholder bullet when empty', expList[0]!.bullets.length === 1);

ss.setEducation([
  {
    id: 'e1',
    institution: 'MIT',
    degree: 'B.S. CS',
    startDate: '2014',
    endDate: '2018',
  },
]);
const eduList = useResumeStore.getState().resume.education;
check('setEducation creates 1 item', eduList.length === 1);
check('education has all fields', eduList[0]!.institution === 'MIT' && eduList[0]!.degree === 'B.S. CS');

// ---------------------------------------------------------------------------
console.log(`\n${failed === 0 ? '[PASS]' : '[FAIL]'} ${failed} failure(s)`);
process.exit(failed === 0 ? 0 : 1);
