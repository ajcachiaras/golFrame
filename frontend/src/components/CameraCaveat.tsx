export default function CameraCaveat() {
  return (
    <p className="caveat">
      These numbers come from a single 2D camera view. Shoulder turn, hip turn, X-factor, and head sway
      read best from a face-on camera (lateral movement gets foreshortened from other angles); swing
      plane reads best from down-the-line instead — there's no single angle that's ideal for every
      number. Tempo and spine tilt hold up well across different camera angles. Camera roll (a tilted
      phone) is corrected automatically, but the actual shooting angle isn't.
    </p>
  )
}
