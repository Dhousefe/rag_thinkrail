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

    // Pulso senoidal contínuo e orgânico calculado 100% na GPU a partir de time
    let time = camera.glowParams.z;
    let wavePulse = sin(time * 3.2 + input.position.x * 1.8 + input.position.z * 1.8) * 0.5 + 0.5;

    // Se houver pulso ativo de busca ou telemetria RAG, modula com a onda da GPU
    let activityIntensity = camera.glowParams.y;
    let pulseBoost = camera.glowParams.x * 0.5 + activityIntensity * 0.35 * wavePulse;
    let brightRgb = col.rgb * (1.0 + pulseBoost);
    output.color = vec4<f32>(brightRgb, col.a);

    return output;
}

@fragment
fn fs_line(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
}

// Sprite vertex/fragment pair for instanced icon quads
struct SpriteVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,
};

@group(0) @binding(1) var atlasSampler: sampler;
@group(0) @binding(2) var atlasTexture: texture_2d<f32>;

@vertex
fn vs_sprite(
    @builtin(vertex_index) vertexIdx: u32,
    @location(0) instancePos: vec3<f32>,
    @location(1) instanceSize: f32,
    @location(2) instanceColor: vec4<f32>,
    @location(3) instanceUv: vec4<f32>
) -> SpriteVertexOutput {
    var output: SpriteVertexOutput;

    // Quad de 6 vértices via vertex_index (2 triângulos: 0, 1, 2, 2, 3, 0)
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, -0.5),
        vec2<f32>( 0.5, -0.5),
        vec2<f32>( 0.5,  0.5),
        vec2<f32>(-0.5, -0.5),
        vec2<f32>( 0.5,  0.5),
        vec2<f32>(-0.5,  0.5)
    );

    let corner = corners[vertexIdx % 6u];

    // Projeção do ponto central
    let centerClip = camera.viewProjMatrix * vec4<f32>(instancePos, 1.0);

    // Expansão do quad billboard virado para a câmera com aspect ratio fixo
    let quadOffset = vec4<f32>(corner * instanceSize * 0.05, 0.0, 0.0);
    output.position = centerClip + quadOffset;
    output.color = instanceColor;

    // Interpolação UV mapeando [u0, v0, u1, v1] do atlas
    let u = mix(instanceUv.x, instanceUv.z, corner.x + 0.5);
    let v = mix(instanceUv.y, instanceUv.w, corner.y + 0.5);
    output.uv = vec2<f32>(u, v);

    return output;
}

@fragment
fn fs_sprite(input: SpriteVertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(atlasTexture, atlasSampler, input.uv);
    return texColor * input.color;
}

`;
