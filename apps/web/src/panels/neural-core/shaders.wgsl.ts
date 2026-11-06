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
};

@vertex
fn vs_line(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Posicionamento espacial geométrico estável e exato (sem distorções de onda oscilatórias)
    let worldPos = vec4<f32>(input.position, 1.0);
    output.position = camera.viewProjMatrix * worldPos;

    // Preservação pura e vívida das cores semânticas de cada módulo e tipo de nó
    // (verde=UI, ciano=Web, azul=Server, amarelo=Contracts, vermelho=Scripts)
    var col = input.color;

    // Se houver pulso ativo de busca ou telemetria, aplica boost luminoso no brilho sem alterar o matiz
    let pulseBoost = camera.glowParams.x * 0.45;
    let brightRgb = col.rgb * (1.0 + pulseBoost);
    output.color = vec4<f32>(brightRgb, col.a);

    return output;
}

@fragment
fn fs_line(input: VertexOutput) -> @location(0) vec4<f32> {
    // Renderização limpa de linhas e polígonos sem oclusão por depthFade agressivo
    return input.color;
}
`;
