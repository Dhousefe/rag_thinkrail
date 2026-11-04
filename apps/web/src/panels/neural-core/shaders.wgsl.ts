export const GEOMETRY_RENDER_WGSL = /* wgsl */ `
struct CameraUniforms {
    viewProjMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    colorTint: vec4<f32>,
    glowParams: vec4<f32>, // x: pulse, y: intensity, z: time, w: mode
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) depth: f32,
};

@vertex
fn vs_line(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Aplica deformação sutil de respiração matemática nos vértices
    var pos = input.position;
    let dist = length(pos);
    let wave = sin(dist * 3.0 - camera.glowParams.z * 4.0) * camera.glowParams.x * 0.08;
    pos += normalize(pos + vec3<f32>(0.001)) * wave;

    let worldPos = camera.modelMatrix * vec4<f32>(pos, 1.0);
    output.position = camera.viewProjMatrix * worldPos;

    // Mistura cor do vértice com colorTint reativo
    var finalColor = mix(input.color, camera.colorTint, 0.45);
    // Intensificação em pulso
    finalColor = vec4<f32>(finalColor.rgb * (1.0 + camera.glowParams.y * 1.5), finalColor.a);

    output.color = finalColor;
    output.depth = output.position.z / output.position.w;
    return output;
}

@fragment
fn fs_line(input: VertexOutput) -> @location(0) vec4<f32> {
    // Brilho de laser vetorial com atenuação por profundidade
    let depthFade = smoothstep(1.0, 0.1, input.depth);
    return vec4<f32>(input.color.rgb, input.color.a * depthFade);
}
`;
