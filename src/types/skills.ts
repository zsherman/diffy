export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  sourceUrl?: string;
}

export interface Skill extends SkillMetadata {
  content: string; // Full markdown body after frontmatter
}
